import pool from '../config/db';

export interface Job {
    id: string;
    url: string;
    type: string; // 'FORM_SUBMISSION' | 'GMAIL'
    status: string;
    profile_id: string;
    custom_data: any;
    file_path?: string | null;
    retries?: number;
    form_name: string;
    created_at?: Date;
    started_at: Date | null;
    completed_at: Date | null;
    priority: number;
}

export const JobModel = {
    getAll: async () => {
        const result = await pool.query(`
            SELECT jobs.*, profiles.name as profile_name 
            FROM jobs 
            LEFT JOIN profiles ON jobs.profile_id = profiles.id 
            ORDER BY created_at DESC
        `);
        return result.rows;
    },

    getById: async (id: string) => {
        const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
        return result.rows[0];
    },

    create: async (url: string, profile_id: string, custom_data: any, file_path: string | null, form_name: string, priority: number = 0, type: string = 'FORM_SUBMISSION') => {
        const result = await pool.query(
            'INSERT INTO jobs (url, profile_id, custom_data, file_path, form_name, priority, type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [url, profile_id, custom_data, file_path, form_name, priority, type]
        );
        return result.rows[0];
    },

    delete: async (id: string) => {
        await pool.query('DELETE FROM jobs WHERE id = $1', [id]);
    },

    deleteAll: async () => {
        // Also delete logs? Logs have FK cascade usually or we should delete them too?
        // Assuming logs have ON DELETE CASCADE or we might orphan them.
        // Let's assume we want to clear everything.
        await pool.query('TRUNCATE jobs CASCADE');
    },

    update: async (id: string, updates: any) => {
        const keys = Object.keys(updates);
        if (keys.length === 0) return;

        const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
        const values = [id, ...Object.values(updates)];

        await pool.query(`UPDATE jobs SET ${setClause} WHERE id = $1`, values);
    },

    updatePriority: async (id: string, priority: number) => {
        await pool.query('UPDATE jobs SET priority = $1 WHERE id = $2', [priority, id]);
    },

    resetPendingPriorities: async (exceptId: string) => {
        // Reset all PENDING jobs to Normal (0) except the one being promoted
        await pool.query(
            "UPDATE jobs SET priority = 0 WHERE status = 'PENDING' AND id != $1 AND priority != 0",
            [exceptId]
        );
    },

    // Used by TaskQueue mainly
    getPending: async (limit: number = 1) => {
        return pool.query(`
            SELECT * FROM jobs WHERE status = 'PENDING' ORDER BY priority ASC, created_at ASC FOR UPDATE SKIP LOCKED LIMIT $1
        `, [limit]);
    },

    // Crash recovery
    failStuckJobs: async () => {
        const result = await pool.query(
            `UPDATE jobs SET status = 'FAILED', completed_at = NOW() WHERE status = 'PROCESSING' RETURNING id`
        );
        return result.rowCount;
    }
};
