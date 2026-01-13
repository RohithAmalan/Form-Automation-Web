
import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

// 1. Load Environment Variables
console.log("🔍 1. Loading Environment Variables...");
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

const clientId = process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const callbackUrl = process.env.CALLBACK_URL || "";
const dbUrl = process.env.DATABASE_URL || "";

// 2. Check Variables
let hasErrors = false;

if (!clientId || clientId.length < 10 || clientId.includes("your_client_id")) {
    console.error("❌ GOOGLE_CLIENT_ID is invalid or missing.");
    hasErrors = true;
} else {
    console.log("✅ GOOGLE_CLIENT_ID is set.");
}

if (!clientSecret || clientSecret.length < 5) {
    console.error("❌ GOOGLE_CLIENT_SECRET is invalid or missing.");
    hasErrors = true;
} else {
    console.log("✅ GOOGLE_CLIENT_SECRET is set.");
}

if (!callbackUrl.includes("http://localhost:3001/auth/google/callback")) {
    console.error(`❌ CALLBACK_URL seems incorrect. Expected 'http://localhost:3001/auth/google/callback', got '${callbackUrl}'`);
    hasErrors = true;
} else {
    console.log("✅ CALLBACK_URL is set correctly.");
}

// 3. Database Check
console.log("\n🔍 2. Checking Database Connection...");
const pool = new Pool({ connectionString: dbUrl });

(async () => {
    try {
        const client = await pool.connect();
        console.log("✅ Database Connected!");

        // 4. Check Tables
        const resTables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);

        const tables = resTables.rows.map(r => r.table_name);
        console.log(`📊 Found Tables: ${tables.join(", ")}`);

        if (!tables.includes("users")) {
            console.error("❌ 'users' table is MISSING!");
            hasErrors = true;
        } else {
            console.log("✅ 'users' table exists.");
        }

        if (!tables.includes("session")) {
            console.error("❌ 'session' table is MISSING! (Required for login)");
            hasErrors = true;
        } else {
            console.log("✅ 'session' table exists.");
        }

        client.release();
    } catch (e: any) {
        console.error("❌ Database Connection Failed:", e.message);
        hasErrors = true;
    } finally {
        await pool.end();
        console.log("\n---------------------------------");
        if (hasErrors) {
            console.log("🛑 SETUP FAILED. Please fix the errors above.");
            process.exit(1);
        } else {
            console.log("🚀 SETUP OK! You can safely run the server.");
            process.exit(0);
        }
    }
})();
