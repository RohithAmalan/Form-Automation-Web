import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function migrate() {
    try {
        await client.connect();
        console.log("Connected to DB...");

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                display_name VARCHAR(255),
                photo_url TEXT,
                role VARCHAR(20) NOT NULL DEFAULT 'user',
                last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Check if role column exists (for existing tables)
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='role';
        `);

        if (res.rows.length === 0) {
            console.log("Adding role column to existing users table...");
            await client.query(`ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';`);
        }

        console.log("✅ Users table migration successful!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration Failed", err);
        process.exit(1);
    }
}

migrate();
