import pool from '../config/db';

async function migrate() {
    try {
        console.log("Checking for 'priority' column in 'jobs' table...");
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='jobs' AND column_name='priority'
        `);

        if (res.rowCount === 0) {
            console.log("Adding 'priority' column...");
            await pool.query(`
                ALTER TABLE jobs ADD COLUMN priority INTEGER DEFAULT 0;
            `);
            console.log("Migration successful: 'priority' column added.");
        } else {
            console.log("'priority' column already exists. Skipping.");
        }
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
}

migrate();
