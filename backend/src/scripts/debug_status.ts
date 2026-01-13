
import pool from '../config/db';

async function check() {
    try {
        const res = await pool.query("SELECT id, status, priority, created_at, form_name FROM jobs ORDER BY created_at DESC LIMIT 10");
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
