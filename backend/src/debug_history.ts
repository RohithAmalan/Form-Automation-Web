
import pool from './config/db';

async function check() {
    console.log("--- DEBUGGING HISTORY ---");
    const targetUrl = "https://formy-project.herokuapp.com/form";

    // 1. Check Jobs
    const jobs = await pool.query("SELECT id, status, completed_at FROM jobs WHERE url = $1 ORDER BY created_at DESC", [targetUrl]);
    console.log(`Jobs found for URL: ${jobs.rowCount}`);
    jobs.rows.forEach(j => console.log(` - Job ${j.id}: ${j.status} (Ended: ${j.completed_at})`));

    // 2. Check Templates
    const templates = await pool.query("SELECT * FROM form_templates WHERE url = $1", [targetUrl]);
    console.log(`Templates found for URL: ${templates.rowCount}`);
    if ((templates.rowCount ?? 0) > 0) {
        console.log("Actions count:", templates.rows[0].actions.length);
    } else {
        console.log("❌ No template found in DB for this URL.");
    }

    // 3. Check logs for the latest job
    if (jobs.rowCount && jobs.rowCount > 0) {
        const lastJobId = jobs.rows[0].id; // First one is latest due to DESC sort
        console.log(`\n--- LOGS FOR JOB ${lastJobId} ---`);

        // Logs table is 'logs'
        const logs = await pool.query("SELECT message, action_type as type FROM logs WHERE job_id = $1 ORDER BY timestamp ASC", [lastJobId]);
        logs.rows.forEach(l => console.log(`[${l.type}] ${l.message}`));
    }

    process.exit();
}

check();
