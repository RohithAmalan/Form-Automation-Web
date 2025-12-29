import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function createTable() {
    try {
        await client.connect();
        console.log("Connected to DB...");

        const query = `
            CREATE TABLE IF NOT EXISTS form_templates (
                id SERIAL PRIMARY KEY,
                url TEXT UNIQUE NOT NULL,
                actions JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;

        await client.query(query);
        console.log("✅ Table 'form_templates' created successfully!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to create table", err);
        process.exit(1);
    }
}

createTable();
