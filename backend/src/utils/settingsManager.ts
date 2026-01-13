import fs from 'fs';
import path from 'path';

const SETTINGS_PATH = path.join(__dirname, '../../data/settings.json');

export interface SystemSettings {
    maxRetries: number;
    retryBackoffMs: number;
    headless: boolean;
    concurrency: number;
    openaiApiKey?: string;
    // Queue Settings
    defaultPriority: number; // 0=High, 1=Normal
    runtimePriorityOverride: boolean;
    retryEscalation: boolean;
    pollInterval: number;
    // Timeout Settings
    pageLoadTimeoutMs: number;
    elementWaitTimeoutMs: number;
    // AI Settings
    primaryModel: string;
    fallbackModel: string;
    exclusivePriority?: boolean;
}

const DEFAULTS: SystemSettings = {
    maxRetries: Number(process.env.MAX_RETRIES) || 2,
    retryBackoffMs: Number(process.env.RETRY_BACKOFF_MS) || 2000,
    headless: process.env.HEADLESS !== 'false', // Default to true unless explicitly false
    concurrency: Number(process.env.CONCURRENCY) || 1,
    defaultPriority: 0, // Normal
    runtimePriorityOverride: true,
    retryEscalation: false,
    pollInterval: 2000,
    // Timeouts
    pageLoadTimeoutMs: Number(process.env.PAGE_LOAD_TIMEOUT_MS) || 60000,
    elementWaitTimeoutMs: Number(process.env.ELEMENT_WAIT_TIMEOUT_MS) || 10000,
    // AI
    primaryModel: "openai/gpt-4o-mini",
    fallbackModel: "google/gemini-flash-1.5",
    // Priority Logic
    exclusivePriority: false
};

export class SettingsManager {
    static getSettings(): SystemSettings {
        // Ensure directory exists
        const dir = path.dirname(SETTINGS_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        if (!fs.existsSync(SETTINGS_PATH)) {
            return { ...DEFAULTS };
        }
        try {
            const fileData = fs.readFileSync(SETTINGS_PATH, 'utf-8');
            const userSettings = JSON.parse(fileData);
            return { ...DEFAULTS, ...userSettings };
        } catch (e) {
            console.error("Failed to read settings.json:", e);
            return DEFAULTS;
        }
    }

    static updateSettings(newSettings: Partial<SystemSettings>): SystemSettings {
        const current = this.getSettings();
        const updated = { ...current, ...newSettings };

        // Don't save API key if it's masked or empty
        if (updated.openaiApiKey === 'sk-****') delete updated.openaiApiKey;

        // Ensure data dir exists (redundant but safe)
        const dir = path.dirname(SETTINGS_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2));
        return updated;
    }

    static get<K extends keyof SystemSettings>(key: K): SystemSettings[K] {
        return this.getSettings()[key];
    }
}
