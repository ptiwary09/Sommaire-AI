import Stripe from 'stripe';
import { getDbConnection } from './db';

// Main webhook handler
export async function handleCheckoutSessionCompleted({
    session,
    stripe,
}: {
    session: Stripe.Checkout.Session;
    stripe: Stripe;
}) {
    console.log('🚨 WEBHOOK CALLED - Session ID:', session.id);
    console.log('🚨 WEBHOOK CALLED - Session Status:', session.status);
    console.log('🚨 WEBHOOK CALLED - Customer:', session.customer);
    
    try {
        // Check if we have required data
        const customerId = session.customer as string;
        if (!customerId) {
            console.error('❌ No customer ID in session');
            return;
        }
        
        console.log('📋 Retrieving customer from Stripe...');
        const customer = await stripe.customers.retrieve(customerId);
        console.log('📋 Customer retrieved:', customer);
        
        if (!customer || customer.deleted) {
            console.error('❌ Customer not found or deleted');
            return;
        }
        
        if (!('email' in customer) || !customer.email) {
            console.error('❌ Customer has no email');
            return;
        }
        
        const priceId = session.line_items?.data[0]?.price?.id;
        if (!priceId) {
            console.error('❌ No price ID found in session');
            return;
        }
        
        const { email, name } = customer;
        console.log('📋 Processing payment for:', { email, name, customerId, priceId });
        
        // Get database connection
        const sql = await getDbConnection();
        console.log('📋 Database connection established');
        
        // Create or update user
        console.log('📋 Creating/updating user...');
        const userId = await createOrUpdateUser({
            sql,
            email: email as string,
            fullName: name as string || '',
            customerId,
            priceId,
            status: 'active',
        });
        
        console.log('📋 User processed, ID:', userId);
        
        // Create payment record
        console.log('📋 Creating payment record...');
        await createPayment({
            sql,
            session,
            priceId,
            userEmail: email as string,
        });
        
        console.log('✅ Payment processing completed successfully');
        
    } catch (error) {
        console.error('❌ Error in handleCheckoutSessionCompleted:', error);
        if (error instanceof Error) {
            console.error('❌ Error stack:', error.stack);
        }
        throw error;
    }
}

// Create or update user function
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
        console.log('📋 Checking if user exists for email:', email);
        
        const existingUser = await sql`
            SELECT id, email, customer_id FROM users WHERE email = ${email}
        `;
        
        console.log('📋 User query result:', existingUser);
        
        if (existingUser.length === 0) {
            console.log('📋 Creating new user...');
            
            const newUser = await sql`
                INSERT INTO users (email, full_name, customer_id, price_id, status)
                VALUES (${email}, ${fullName}, ${customerId}, ${priceId}, ${status})
                RETURNING id, email, customer_id
            `;
            
            console.log('✅ New user created:', newUser[0]);
            return newUser[0].id;
            
        } else {
            console.log('📋 User exists, updating...');
            
            const updatedUser = await sql`
                UPDATE users 
                SET 
                    customer_id = ${customerId},
                    price_id = ${priceId},
                    status = ${status},
                    full_name = ${fullName || existingUser[0].full_name},
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = ${email}
                RETURNING id, email, customer_id
            `;
            
            console.log('✅ User updated:', updatedUser[0]);
            return existingUser[0].id;
        }
        
    } catch (error) {
        console.error('❌ Error in createOrUpdateUser:', error);
        console.error('❌ User data:', { email, fullName, customerId, priceId, status });
        throw error;
    }
}

// Create payment function
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
            session_id: id,
            status,
            priceId,
            userEmail
        });
        
        // Check if payment already exists
        const existingPayment = await sql`
            SELECT id FROM payments WHERE stripe_payment_id = ${id}
        `;
        
        if (existingPayment.length > 0) {
            console.log('⚠️ Payment already exists for session:', id);
            return;
        }
        
        console.log('📋 Inserting new payment...');
        
        const newPayment = await sql`
            INSERT INTO payments (amount, status, stripe_payment_id, price_id, user_email)
            VALUES (${amount_total}, ${status}, ${id}, ${priceId}, ${userEmail})
            RETURNING id, stripe_payment_id, amount
        `;
        
        console.log('✅ Payment created:', newPayment[0]);
        
    } catch (error) {
        console.error('❌ Error in createPayment:', error);
        console.error('❌ Payment data:', {
            amount_total: session.amount_total,
            session_id: session.id,
            status: session.status,
            priceId,
            userEmail
        });
        throw error;
    }
}

// Utility functions for debugging and testing

// Test database connection and basic operations
export async function testDatabaseConnection() {
    try {
        console.log('🧪 Testing database connection...');
        const sql = await getDbConnection();
        
        // Test basic connectivity
        const result = await sql`SELECT NOW() as current_time`;
        console.log('✅ Database connected at:', result[0].current_time);
        
        // Check table structures
        const userTable = await sql`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `;
        console.log('📋 Users table structure:', userTable);
        
        const paymentTable = await sql`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'payments'
        `;
        console.log('📋 Payments table structure:', paymentTable);
        
        // Count existing records
        const userCount = await sql`SELECT COUNT(*) as count FROM users`;
        const paymentCount = await sql`SELECT COUNT(*) as count FROM payments`;
        
        console.log('📊 Current record counts:');
        console.log('   Users:', userCount[0].count);
        console.log('   Payments:', paymentCount[0].count);
        
    } catch (error) {
        console.error('❌ Database connection test failed:', error);
    }
}

// Test with mock data
export async function testPaymentHandlerWithMockData() {
    console.log('🧪 Testing payment handler with mock data...');
    
    const mockSession: Stripe.Checkout.Session = {
        id: 'cs_test_mock_123',
        customer: 'cus_test_mock_123',
        amount_total: 2000,
        status: 'complete',
        line_items: {
            data: [{
                price: {
                    id: 'price_test_mock_123'
                }
            }]
        }
    } as any;
    
    const mockStripe = {
        customers: {
            retrieve: async (customerId: string) => {
                console.log('🧪 Mock retrieving customer:', customerId);
                return {
                    id: customerId,
                    email: 'test@example.com',
                    name: 'Test User Mock',
                    deleted: false
                };
            }
        }
    } as any;
    
    try {
        await handleCheckoutSessionCompleted({
            session: mockSession,
            stripe: mockStripe
        });
        console.log('✅ Mock test completed');
    } catch (error) {
        console.error('❌ Mock test failed:', error);
    }
}

// Get user data for debugging
export async function getUserData(email: string) {
    try {
        const sql = await getDbConnection();
        
        const user = await sql`SELECT * FROM users WHERE email = ${email}`;
        const payments = await sql`SELECT * FROM payments WHERE user_email = ${email}`;
        
        console.log('📋 User data:', user[0] || 'Not found');
        console.log('📋 User payments:', payments);
        
        return { user: user[0], payments };
    } catch (error) {
        console.error('❌ Error getting user data:', error);
        return null;
    }
}

// Clean up test data
export async function cleanupTestData() {
    try {
        const sql = await getDbConnection();
        
        await sql`DELETE FROM payments WHERE stripe_payment_id LIKE 'cs_test_%'`;
        await sql`DELETE FROM users WHERE email LIKE '%test%' OR email LIKE '%example%'`;
        
        console.log('✅ Test data cleaned up');
    } catch (error) {
        console.error('❌ Error cleaning up test data:', error);
    }
}