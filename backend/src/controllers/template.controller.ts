import { Request, Response } from 'express';
import pool from '../config/db';
import { TemplateModel } from '../models/template.model';

export const TemplateController = {
    // Get all templates (history)
    getAll: async (req: Request, res: Response) => {
        try {
            const result = await pool.query("SELECT * FROM form_templates ORDER BY updated_at DESC");
            res.json(result.rows);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { name } = req.body;
            if (!name) {
                res.status(400).json({ error: "Name is required" });
                return;
            }
            const updated = await TemplateModel.updateName(Number(id), name);
            res.json(updated);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await TemplateModel.delete(Number(id));
            res.json({ success: true });
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    }
};
