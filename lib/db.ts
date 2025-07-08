import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

export async function getDbConnection() {
    try {
        // Test the connection
        await sql`SELECT 1`;
        console.log('✅ Database connection established');
        return sql;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
}

export { sql };