
import pool from '../src/config/db';
import bcrypt from 'bcrypt';

const verifyCtx = async () => {
    try {
        console.log("🔍 Verifying Login Logic...");
        const email = 'admin@local';
        const password = 'admin123';

        // 1. Check DB Connection
        const dbRes = await pool.query("SELECT current_database()");
        console.log(`ℹ️  Connected to DB: ${dbRes.rows[0].current_database}`);

        // 2. Fetch User
        const res = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (res.rows.length === 0) {
            console.error("❌ User not found!");
            process.exit(1);
        }
        const user = res.rows[0];
        console.log("✅ User found:", user.email, "Role:", user.role);

        // 3. Check Hash
        if (!user.password_hash) {
            console.error("❌ No password hash!");
            process.exit(1);
        }

        // 4. Compare
        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            console.log("✅ Password Match! Login Logic is CORRECT.");
        } else {
            console.error("❌ Password Mismatch!");
        }

        process.exit(0);

    } catch (e) {
        console.error("❌ Error:", e);
        process.exit(1);
    }
};

verifyCtx();
