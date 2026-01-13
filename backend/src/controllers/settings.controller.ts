import { Request, Response } from 'express';
import { SettingsManager } from '../utils/settingsManager';

export class SettingsController {
    static getSettings(req: Request, res: Response) {
        try {
            const settings = SettingsManager.getSettings();
            // Mask API Key for security
            // Mask API Key for security
            if (settings.config.openaiApiKey) {
                settings.config.openaiApiKey = 'sk-****' + settings.config.openaiApiKey.slice(-4);
            }
            res.json(settings);
        } catch (error) {
            console.error("Error fetching settings:", error);
            res.status(500).json({ error: "Failed to fetch settings" });
        }
    }

    static updateSettings(req: Request, res: Response) {
        try {
            const updates = req.body;
            // Basic Validation
            if (updates.maxRetries && typeof updates.maxRetries !== 'number') return res.status(400).json({ error: "maxRetries must be a number" });
            if (updates.retryBackoffMs && typeof updates.retryBackoffMs !== 'number') return res.status(400).json({ error: "retryBackoffMs must be a number" });

            const updated = SettingsManager.updateSettings(updates);
            res.json({ success: true, settings: updated });
        } catch (error) {
            console.error("Error updating settings:", error);
            res.status(500).json({ error: "Failed to update settings" });
        }
    }

    static getHealth(req: Request, res: Response) {
        // Check BOTH Runtime Settings AND Environment Variables
        // The runtime settings manager might be empty if the user hasn't overridden anything,
        // but the app is still valid if .env has the key.
        const settings = SettingsManager.getSettings();
        const hasKey = !!settings.config.openaiApiKey || !!process.env.OPENROUTER_API_KEY || !!process.env.OPENAI_API_KEY;

        res.json({
            db: 'connected', // Ideally check real DB connection
            ai: hasKey ? 'configured' : 'missing',
            version: '1.1.0'
        });
    }
}
