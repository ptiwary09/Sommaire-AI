import { handleCheckoutSessionCompleted } from '@/lib/payments';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const POST = async (req: NextRequest) => {
    console.log('🔔 Webhook received!'); // Debug log
    
    const payload = await req.text();
    const sig = req.headers.get('stripe-signature');
    let event;
    
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    
    // Check if environment variables exist
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('❌ STRIPE_SECRET_KEY is missing');
        return NextResponse.json({ error: 'Missing Stripe secret key' }, { status: 500 });
    }
    
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('❌ STRIPE_WEBHOOK_SECRET is missing');
        return NextResponse.json({ error: 'Missing webhook secret' }, { status: 500 });
    }
    
    try {
        event = stripe.webhooks.constructEvent(payload, sig!, endpointSecret);
        console.log('✅ Webhook signature verified');
        
        switch (event.type) {
            case 'checkout.session.completed':
                // ✅ FIXED: Get the full session object with validation
                const basicSession = event.data.object as Stripe.Checkout.Session;
                
                // Validate session object
                if (!basicSession || !basicSession.id) {
                    console.error('❌ Invalid session object');
                    break;
                }
                
                const sessionId = basicSession.id;
                
                try {
                    // 🔄 Retrieve session with expanded line items
                    const session = await stripe.checkout.sessions.retrieve(sessionId, {
                        expand: ['line_items', 'line_items.data.price.product']
                    });
                    await handleCheckoutSessionCompleted({session,stripe});
                    console.log('💰 Payment completed!');
                    console.log('Session ID:', sessionId);
                    console.log('Customer Email:', session.customer_email);
                    console.log('Customer ID:', session.customer);
                    console.log('Amount Total:', session.amount_total);
                    console.log('Currency:', session.currency);
                    
                    // 📦 Log line items details
                    if (session.line_items && session.line_items.data) {
                        console.log('🛍️ Line Items:');
                        session.line_items.data.forEach((item, index) => {
                            console.log(`  Item ${index + 1}:`);
                            console.log(`    Description: ${item.description}`);
                            console.log(`    Quantity: ${item.quantity}`);
                            console.log(`    Amount Total: ${item.amount_total}`);
                            console.log(`    Price ID: ${item.price?.id}`);
                            
                            // If product is expanded
                            if (item.price?.product && typeof item.price.product === 'object') {
                                const product = item.price.product;
                                
                                // Use type guard to check if product is active
                                if (isActiveProduct(product)) {
                                    console.log(`    Product Name: ${product.name}`);
                                    console.log(`    Product ID: ${product.id}`);
                                    console.log(`    Product Description: ${product.description || 'N/A'}`);
                                    console.log(`    Product Active: ${product.active}`);
                                } else {
                                    console.log(`    Product ID: ${product.id} (DELETED)`);
                                }
                            }
                        });
                    }
                    
                    // If customer_email is null, fetch customer details
                    if (!session.customer_email && session.customer && typeof session.customer === 'string') {
                        try {
                            const customer = await stripe.customers.retrieve(session.customer);
                            
                            // Check if customer is not deleted
                            if (!customer.deleted) {
                                console.log('📧 Customer Email from Customer object:', customer.email);
                                console.log('👤 Customer Name:', customer.name);
                            } else {
                                console.log('❌ Customer was deleted');
                            }
                        } catch (error) {
                            console.log('❌ Error fetching customer:', error);
                        }
                    }
                    
                    // 💾 Add your business logic here
                    await processCompletedPayment(session);
                    
                } catch (error) {
                    console.error('❌ Error retrieving session with line items:', error);
                }
                
                break;
            
            case 'customer.subscription.deleted':
                const subscription = event.data.object as Stripe.Subscription;
                console.log('❌ Subscription cancelled');
                console.log('Subscription ID:', subscription.id);
                console.log('Customer:', subscription.customer);
                break;
            
            default:
                console.log(`⚠️ Unhandled event type: ${event.type}`);
        }
        
        return NextResponse.json({
            status: 'success',
            received: true
        });
        
    } catch (err) {
        console.error('❌ Webhook error:', err);
        return NextResponse.json({
            error: 'Webhook signature verification failed',
            details: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 400 });
    }
};

// 🔧 Type guard to check if product is not deleted
function isActiveProduct(product: Stripe.Product | Stripe.DeletedProduct): product is Stripe.Product {
    return !product.deleted;
}

// 🔧 Business logic function to process completed payment
async function processCompletedPayment(session: Stripe.Checkout.Session) {
    try {
        console.log('🔄 Processing completed payment...');
        
        // Extract key information
        const sessionId = session.id;
        const customerEmail = session.customer_email || 
                            (session.customer_details?.email) || 
                            null;
        const customerId = session.customer as string;
        const amountTotal = session.amount_total;
        const currency = session.currency;
        
        // Get line items for processing
        const lineItems = session.line_items?.data || [];
        
        // 1. Save to database
        await savePaymentToDatabase({
            sessionId,
            customerEmail,
            customerId,
            amountTotal,
            currency,
            lineItems
        });
        
        // 2. Send confirmation email
        if (customerEmail) {
            await sendConfirmationEmail(customerEmail, sessionId, lineItems);
        }
        
        // 3. Update inventory (if applicable)
        await updateInventory(lineItems);
        
        // 4. Trigger any other business logic
        await triggerPostPaymentActions(session);
        
        console.log('✅ Payment processing completed successfully');
        
    } catch (error) {
        console.error('❌ Error processing payment:', error);
        // You might want to implement retry logic or alert systems here
    }
}

// 💾 Save payment to database
async function savePaymentToDatabase(paymentData: {
    sessionId: string;
    customerEmail: string | null;
    customerId: string;
    amountTotal: number | null;
    currency: string | null;
    lineItems: Stripe.LineItem[];
}) {
    try {
        console.log('💾 Saving payment to database...');
        
        // Your database logic here
        // Example with Prisma:
        /*
        await prisma.payment.create({
            data: {
                sessionId: paymentData.sessionId,
                customerEmail: paymentData.customerEmail,
                customerId: paymentData.customerId,
                amount: paymentData.amountTotal,
                currency: paymentData.currency,
                status: 'completed',
                lineItems: {
                    create: paymentData.lineItems.map(item => ({
                        priceId: item.price?.id,
                        quantity: item.quantity,
                        amount: item.amount_total,
                        description: item.description
                    }))
                }
            }
        });
        */
        
        console.log('✅ Payment saved to database');
    } catch (error) {
        console.error('❌ Error saving to database:', error);
        throw error;
    }
}

// 📧 Send confirmation email
async function sendConfirmationEmail(
    email: string, 
    sessionId: string, 
    lineItems: Stripe.LineItem[]
) {
    try {
        console.log('📧 Sending confirmation email...');
        
        // Your email service logic here
        // Example with SendGrid, Nodemailer, etc.
        /*
        const emailData = {
            to: email,
            subject: 'Payment Confirmation',
            html: generateEmailTemplate(sessionId, lineItems)
        };
        
        await emailService.send(emailData);
        */
        
        console.log('✅ Confirmation email sent');
    } catch (error) {
        console.error('❌ Error sending email:', error);
        throw error;
    }
}

// 📦 Update inventory
async function updateInventory(lineItems: Stripe.LineItem[]) {
    try {
        console.log('📦 Updating inventory...');
        
        for (const item of lineItems) {
            if (item.price?.product && typeof item.price.product === 'object') {
                const product = item.price.product;
                const quantity = item.quantity || 0;
                
                // Use type guard to check if product is active
                if (isActiveProduct(product)) {
                    const productId = product.id;
                    const productName = product.name;
                    
                    // Your inventory update logic here
                    /*
                    await prisma.product.update({
                        where: { id: productId },
                        data: {
                            stock: {
                                decrement: quantity
                            }
                        }
                    });
                    */
                    
                    console.log(`📉 Updated inventory for product ${productName} (${productId}): -${quantity}`);
                } else {
                    console.log(`⚠️ Skipping inventory update for deleted product: ${product.id}`);
                }
            }
        }
        
        console.log('✅ Inventory updated');
    } catch (error) {
        console.error('❌ Error updating inventory:', error);
        throw error;
    }
}

// 🚀 Trigger other post-payment actions
async function triggerPostPaymentActions(session: Stripe.Checkout.Session) {
    try {
        console.log('🚀 Triggering post-payment actions...');
        
        // Examples of other actions:
        // - Send webhook to other services
        // - Update customer loyalty points
        // - Generate invoice
        // - Start subscription if applicable
        // - Send notification to admin
        
        console.log('✅ Post-payment actions completed');
    } catch (error) {
        console.error('❌ Error in post-payment actions:', error);
        throw error;
    }
}