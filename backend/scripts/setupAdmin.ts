
import pool from '../src/config/db';
import bcrypt from 'bcrypt';

const runMigration = async () => {
    try {
        console.log("🔌 Connecting to DB...");

        const dbRes = await pool.query("SELECT current_database()");
        console.log(`ℹ️  Connected to database: ${dbRes.rows[0].current_database}`);

        // 1. Add password_hash column if not exists
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS password_hash TEXT;
        `);
        console.log("✅ Column 'password_hash' added (or already exists).");

        // 2. Add role column if not exists (just in case schema.sql wasn't fully applied)
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
        `);
        console.log("✅ Column 'role' added (or already exists).");

        // 3. Create/Update Admin User
        const email = 'admin@local';
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if admin exists
        const res = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

        if (res.rows.length === 0) {
            await pool.query(
                "INSERT INTO users (id, email, display_name, password_hash, role, photo_url) VALUES ($1, $2, $3, $4, $5, $6)",
                ['admin-id-001', email, 'System Admin', hashedPassword, 'admin', 'https://ui-avatars.com/api/?name=Admin']
            );
            console.log("✅ Admin user created: admin@local / admin123");
        } else {
            await pool.query(
                "UPDATE users SET password_hash = $1, role = 'admin' WHERE email = $2",
                [hashedPassword, email]
            );
            console.log("✅ Admin user updated with new password.");
        }

        process.exit(0);
    } catch (e) {
        console.error("❌ Migration Failed:", e);
        process.exit(1);
    }
};

runMigration();
