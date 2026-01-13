
import dotenv from 'dotenv';
import path from 'path';

// mimic prelude.ts
const envPath = path.join(__dirname, '../../.env');
console.log(`🔌 Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

console.log("Environment Variable Check:");
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "✅ Present" : "❌ MISSING");
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "✅ Present" : "❌ MISSING");
console.log("CALLBACK_URL:", process.env.CALLBACK_URL || "Using Default");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "✅ Present" : "❌ MISSING");

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID.includes("your_client_id")) {
    console.log("⚠️  WARNING: GOOGLE_CLIENT_ID appears to be the placeholder value!");
}
