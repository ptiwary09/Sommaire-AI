import Stripe from 'stripe';
import { getDbConnection } from './db';

export async function handleCheckoutSessionCompleted({
    session,
    stripe,
}: {
    session: Stripe.Checkout.Session;
    stripe: Stripe;
}) {
    console.log('🔥 Checkout session completed', session);
    
    try {
        // Debug: Check if we have the required data
        const customerId = session.customer as string;
        console.log('📋 Customer ID from session:', customerId);
        
        if (!customerId) {
            console.error('❌ No customer ID in session');
            return;
        }
        
        const customer = await stripe.customers.retrieve(customerId);
        console.log('📋 Customer retrieved:', customer);
        
        const priceId = session.line_items?.data[0]?.price?.id;
        console.log('📋 Price ID:', priceId);
        
        if (!('email' in customer)) {
            console.error('❌ Customer has no email property');
            return;
        }
        
        if (!priceId) {
            console.error('❌ No price ID found in session');
            return;
        }

        const { email, name } = customer;
        console.log('📋 Processing payment for:', { email, name, customerId, priceId });
        
        const sql = await getDbConnection();
        console.log('📋 Database connection established');

        // Create or update user first
        console.log('📋 Creating/updating user...');
        const userId = await createOrUpdateUser({
            sql,
            email: email as string,
            fullName: name as string,
            customerId,
            priceId: priceId as string,
            status: 'active',
        });
        
        console.log('📋 User processed, ID:', userId);

        // Create payment record
        console.log('📋 Creating payment record...');
        await createPayment({
            sql,
            session,
            priceId: priceId as string,
            userEmail: email as string,
        });

        console.log('✅ User and payment processing completed for user:', userId);
    } catch (error) {
        console.error('❌ Error in handleCheckoutSessionCompleted:', error);
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        // Don't throw - let's see what the actual error is
    }
}

async function createOrUpdateUser({
    sql,
    email,
    fullName,
    customerId,
    priceId,
    status,
}: {
    sql: any;
    email: string;
    fullName: string;
    customerId: string;
    priceId: string;
    status: string;
}) {
    try {
        console.log('📋 Checking if user exists:', email);
        const user = await sql`SELECT * FROM users WHERE email = ${email}`;
        console.log('📋 User query result:', user);
        
        if (user.length === 0) {
            console.log('📋 Creating new user...');
            // Insert new user
            const newUser = await sql`
                INSERT INTO users (email, full_name, customer_id, price_id, status)
                VALUES (${email}, ${fullName}, ${customerId}, ${priceId}, ${status})
                RETURNING id, email
            `;
            console.log('✅ User created successfully:', newUser[0]);
            return newUser[0].id;
        } else {
            console.log('📋 Updating existing user...');
            // Update existing user
            const updatedUser = await sql`
                UPDATE users 
                SET customer_id = ${customerId}, 
                    price_id = ${priceId}, 
                    status = ${status},
                    full_name = ${fullName}
                WHERE email = ${email}
                RETURNING id, email
            `;
            console.log('✅ User updated successfully:', updatedUser[0]);
            return user[0].id;
        }
    } catch (error) {
        console.error('❌ Error creating or updating user:', error);
        console.error('❌ Error details:', {
            email,
            fullName,
            customerId,
            priceId,
            status
        });
        throw error;
    }
}

async function createPayment({
    sql,
    session,
    priceId,
    userEmail,
}: {
    sql: any;
    session: Stripe.Checkout.Session;
    priceId: string;
    userEmail: string;
}) {
    try {
        const { amount_total, id, status } = session;
        console.log('📋 Payment details:', {
            amount_total,
            id,
            status,
            priceId,
            userEmail
        });
        
        // Check if payment already exists
        const existingPayment = await sql`
            SELECT id FROM payments WHERE stripe_payment_id = ${id}
        `;
        
        if (existingPayment.length > 0) {
            console.log('⚠️ Payment already exists:', id);
            return;
        }
        
        console.log('📋 Inserting payment...');
        const paymentResult = await sql`
            INSERT INTO payments (amount, status, stripe_payment_id, price_id, user_email)
            VALUES (${amount_total}, ${status}, ${id}, ${priceId}, ${userEmail})
            RETURNING id, stripe_payment_id
        `;
        
        console.log('✅ Payment created successfully:', paymentResult[0]);
    } catch (error) {
        console.error('❌ Error creating payment:', error);
        console.error('❌ Payment data:', { 
            amount_total: session.amount_total,
            id: session.id, 
            status: session.status,
            priceId,
            userEmail
        });
        throw error;
    }
}

// Add a test function to manually check database connectivity
export async function testDatabaseConnection() {
    try {
        const sql = await getDbConnection();
        
        // Test users table
        const userCount = await sql`SELECT COUNT(*) FROM users`;
        console.log('📋 Users table count:', userCount[0].count);
        
        // Test payments table
        const paymentCount = await sql`SELECT COUNT(*) FROM payments`;
        console.log('📋 Payments table count:', paymentCount[0].count);
        
        // Test recent data
        const recentUsers = await sql`SELECT * FROM users ORDER BY created_at DESC LIMIT 5`;
        console.log('📋 Recent users:', recentUsers);
        
        const recentPayments = await sql`SELECT * FROM payments ORDER BY created_at DESC LIMIT 5`;
        console.log('📋 Recent payments:', recentPayments);
        
        console.log('✅ Database connection test completed');
    } catch (error) {
        console.error('❌ Database connection test failed:', error);
    }
}