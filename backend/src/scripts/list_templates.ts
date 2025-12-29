import pool from '../config/db';

async function listTemplates() {
    try {
        const res = await pool.query("SELECT * FROM form_templates ORDER BY updated_at DESC");

        if (res.rows.length === 0) {
            console.log("No templates found in database.");
            return;
        }

        console.log(`Found ${res.rows.length} cached templates:\n`);

        res.rows.forEach((row, i) => {
            console.log(`[${i + 1}] URL: ${row.url}`);
            console.log(`    Updated: ${row.updated_at}`);
            console.log(`    Actions: ${row.actions.length} steps stored.`);
            console.log(`    First Action: ${JSON.stringify(row.actions[0])}`);
            console.log("---------------------------------------------------");
        });

        process.exit(0);
    } catch (e) {
        console.error("Error fetching templates:", e);
        process.exit(1);
    }
}

listTemplates();
