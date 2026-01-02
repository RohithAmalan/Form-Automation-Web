import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function setAdmin() {
    const email = process.argv[2];
    const role = process.argv[3] || 'admin'; // Default to admin, but allow 'user'

    if (!email) {
        console.error("Please provide an email address.");
        console.error("Usage: npx ts-node src/scripts/set_admin.ts <email> [role]");
        process.exit(1);
    }

    try {
        await client.connect();

        // Check if user exists
        const res = await client.query("SELECT * FROM users WHERE email = $1", [email]);
        if (res.rows.length === 0) {
            console.error(`❌ User with email '${email}' not found. Have you logged in at least once?`);
            process.exit(1);
        }

        await client.query("UPDATE users SET role = $1 WHERE email = $2", [role, email]);
        console.log(`✅ Success! User '${email}' role set to '${role}'.`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Error setting admin:", err);
        process.exit(1);
    }
}

setAdmin();
