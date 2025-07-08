import { handleCheckoutSessionCompleted } from '@/lib/payments';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const POST = async (req: NextRequest) => {
    console.log('🔔 Webhook received!');

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

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is missing');
        return NextResponse.json({ error: 'Missing database URL' }, { status: 500 });
    }

    try {
        event = stripe.webhooks.constructEvent(payload, sig!, endpointSecret);
        console.log('✅ Webhook signature verified');
        console.log(`📨 Event type: ${event.type}`);

        switch (event.type) {
            case 'checkout.session.completed':
                const basicSession = event.data.object as Stripe.Checkout.Session;

                // Validate session object
                if (!basicSession || !basicSession.id) {
                    console.error('❌ Invalid session object');
                    break;
                }

                const sessionId = basicSession.id;
                console.log(`🛒 Processing checkout session: ${sessionId}`);

                try {
                    // Retrieve session with expanded line items
                    const session = await stripe.checkout.sessions.retrieve(sessionId, {
                        expand: ['line_items', 'line_items.data.price.product']
                    });

                    console.log('💰 Payment details:');
                    console.log('  Session ID:', sessionId);
                    console.log('  Customer Email:', session.customer_email);
                    console.log('  Customer ID:', session.customer);
                    console.log('  Amount Total:', session.amount_total);
                    console.log('  Currency:', session.currency);
                    console.log('  Status:', session.status);

                    // Log line items
                    if (session.line_items && session.line_items.data) {
                        console.log('🛍️ Line Items:');
                        session.line_items.data.forEach((item, index) => {
                            console.log(`  Item ${index + 1}:`);
                            console.log(`    Description: ${item.description}`);
                            console.log(`    Quantity: ${item.quantity}`);
                            console.log(`    Amount Total: ${item.amount_total}`);
                            console.log(`    Price ID: ${item.price?.id}`);
                        });
                    }

                    // Handle the checkout session completion
                    await handleCheckoutSessionCompleted({ session, stripe });

                    console.log('✅ Checkout session processed successfully');

                } catch (error) {
                    console.error('❌ Error processing checkout session:', error);
                    // Return error status to Stripe for retry
                    return NextResponse.json({
                        error: 'Failed to process checkout session',
                        details: error instanceof Error ? error.message : 'Unknown error'
                    }, { status: 500 });
                }

                break;

            case 'customer.subscription.deleted':
                const subscription = event.data.object as Stripe.Subscription;
                console.log('❌ Subscription cancelled');
                console.log('  Subscription ID:', subscription.id);
                console.log('  Customer:', subscription.customer);
                // TODO: Handle subscription cancellation
                break;

            case 'invoice.payment_succeeded':
                const invoice = event.data.object as Stripe.Invoice;
                console.log('💳 Invoice payment succeeded');
                console.log('  Invoice ID:', invoice.id);
                console.log('  Customer:', invoice.customer);
                // TODO: Handle recurring payments
                break;

            case 'invoice.payment_failed':
                const failedInvoice = event.data.object as Stripe.Invoice;
                console.log('❌ Invoice payment failed');
                console.log('  Invoice ID:', failedInvoice.id);
                console.log('  Customer:', failedInvoice.customer);
                // TODO: Handle failed payments
                break;

            default:
                console.log(`⚠️ Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({
            status: 'success',
            received: true,
            eventType: event.type
        });

    } catch (err) {
        console.error('❌ Webhook error:', err);

        // Check if it's a signature verification error
        if (err instanceof Error && err.message.includes('signature')) {
            console.error('❌ Webhook signature verification failed');
            console.error('❌ Make sure STRIPE_WEBHOOK_SECRET is correct');
        }

        return NextResponse.json({
            error: 'Webhook signature verification failed',
            details: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 400 });
    }
};