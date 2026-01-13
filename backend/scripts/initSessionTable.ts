
import pool from '../src/config/db';

const createSessionTable = async () => {
    console.log("🛠️ Creating session table...");
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS session (
                sid VARCHAR NOT NULL COLLATE "default",
                sess JSON NOT NULL,
                expire TIMESTAMP(6) NOT NULL
            ) WITH (OIDS=FALSE);
            
            ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
            CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
        `);
        console.log("✅ Session table created successfully!");
    } catch (err: any) {
        if (err.message.includes('already exists')) {
            console.log("✅ Session table already exists.");
        } else {
            console.error("❌ Failed to create session table:", err);
        }
    } finally {
        await pool.end();
    }
};

createSessionTable();
