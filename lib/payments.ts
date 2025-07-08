import Stripe from 'stripe';
import { getDbConnection } from './db';

export async function handleCheckoutSessionCompleted({
    session,
    stripe,
}: {
    session: Stripe.Checkout.Session;
    stripe: Stripe;
}) {
    console.log('🔥 Checkout session completed', session.id);

    try {
        const customerId = session.customer as string;

        if (!customerId) {
            console.error('❌ No customer ID found in session');
            return;
        }

        const customer = await stripe.customers.retrieve(customerId);
        const priceId = session.line_items?.data[0]?.price?.id;

        if (!priceId) {
            console.error('❌ No price ID found in session line items');
            return;
        }

        if ('email' in customer && customer.email) {
            const { email, name } = customer;
            const sql = await getDbConnection();

            console.log(`📧 Processing payment for customer: ${email}`);

            // Create or update user first
            const userId = await createOrUpdateUser({
                sql,
                email: email as string,
                fullName: name as string || '',
                customerId,
                priceId: priceId as string,
                status: 'active',
            });

            // Create payment record
            await createPayment({
                sql,
                session,
                priceId: priceId as string,
                userEmail: email as string,
            });

            console.log('✅ User and payment processing completed successfully');
        } else {
            console.error('❌ Customer email not found');
        }
    } catch (error) {
        console.error('❌ Error in handleCheckoutSessionCompleted:', error);
        // Re-throw to ensure webhook returns proper error status
        throw error;
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
        console.log(`👤 Creating/updating user: ${email}`);

        // Check if user exists
        const existingUser = await sql`
            SELECT id, email FROM users WHERE email = ${email}
        `;

        if (existingUser.length === 0) {
            console.log(`➕ Creating new user: ${email}`);
            // Insert new user
            const newUser = await sql`
                INSERT INTO users (email, full_name, customer_id, price_id, status)
                VALUES (${email}, ${fullName}, ${customerId}, ${priceId}, ${status})
                RETURNING id, email
            `;
            console.log('✅ User created successfully:', newUser[0].email);
            return newUser[0].id;
        } else {
            console.log(`🔄 Updating existing user: ${email}`);
            // Update existing user
            const updatedUser = await sql`
                UPDATE users 
                SET customer_id = ${customerId}, 
                    price_id = ${priceId}, 
                    status = ${status},
                    full_name = ${fullName},
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = ${email}
                RETURNING id, email
            `;
            console.log('✅ User updated successfully:', updatedUser[0].email);
            return updatedUser[0].id;
        }
    } catch (error) {
        console.error('❌ Error creating or updating user:', error);
        console.error('❌ SQL Error details:', {
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

        console.log(`💰 Creating payment record for session: ${id}`);

        // Check if payment already exists to avoid duplicates
        const existingPayment = await sql`
            SELECT id FROM payments WHERE stripe_payment_id = ${id}
        `;

        if (existingPayment.length > 0) {
            console.log(`⚠️ Payment already exists for session: ${id}`);
            return;
        }

        // Create new payment record
        const newPayment = await sql`
            INSERT INTO payments (amount, status, stripe_payment_id, price_id, user_email)
            VALUES (${amount_total}, ${status}, ${id}, ${priceId}, ${userEmail})
            RETURNING id, stripe_payment_id
        `;

        console.log('✅ Payment created successfully:', newPayment[0].stripe_payment_id);
    } catch (error) {
        console.error('❌ Error creating payment:', error);
        console.error('❌ Payment details:', {
            sessionId: session.id,
            amount: session.amount_total,
            status: session.status,
            priceId,
            userEmail
        });
        throw error;
    }
}