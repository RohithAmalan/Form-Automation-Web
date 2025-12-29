import pool from '../config/db';

export interface FormTemplate {
    id: number;
    url: string;
    name?: string;
    actions: any[];
    created_at: Date;
    updated_at: Date;
}

export const TemplateModel = {
    getByUrl: async (url: string) => {
        const res = await pool.query('SELECT * FROM form_templates WHERE url = $1', [url]);
        return res.rows[0] || null;
    },

    upsert: async (url: string, actions: any[]) => {
        const query = `
            INSERT INTO form_templates (url, actions, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (url) 
            DO UPDATE SET actions = $2, updated_at = NOW()
            RETURNING *;
        `;
        const res = await pool.query(query, [url, JSON.stringify(actions)]);
        return res.rows[0];
    },

    updateName: async (id: number, name: string) => {
        const res = await pool.query(
            "UPDATE form_templates SET name = $1 WHERE id = $2 RETURNING *",
            [name, id]
        );
        return res.rows[0];
    },

    delete: async (id: number) => {
        await pool.query("DELETE FROM form_templates WHERE id = $1", [id]);
        return true;
    }
};
