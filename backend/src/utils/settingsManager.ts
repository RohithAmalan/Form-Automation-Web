import fs from 'fs';
import path from 'path';

const SETTINGS_PATH = path.join(__dirname, '../../config/settings.json');

export interface SystemSettings {
    queue: {
        maxRetries: number;
        retryBackoffMs: number;
        concurrency: number;
        defaultPriority: number;
        retryEscalation: boolean;
        pollInterval: number;
        exclusivePriority: boolean;
        runtimePriorityOverride: boolean;
    };
    form: {
        headless: boolean;
        pageLoadTimeoutMs: number;
        elementWaitTimeoutMs: number;
    };
    config: {
        primaryModel: string;
        fallbackModel: string;
        openaiApiKey?: string;
    };
}

const DEFAULTS: SystemSettings = {
    queue: {
        maxRetries: Number(process.env.MAX_RETRIES) || 2,
        retryBackoffMs: Number(process.env.RETRY_BACKOFF_MS) || 2000,
        concurrency: Number(process.env.CONCURRENCY) || 1,
        defaultPriority: 0,
        retryEscalation: false,
        pollInterval: 2000,
        exclusivePriority: false,
        runtimePriorityOverride: true
    },
    form: {
        headless: process.env.HEADLESS !== 'false',
        pageLoadTimeoutMs: Number(process.env.PAGE_LOAD_TIMEOUT_MS) || 60000,
        elementWaitTimeoutMs: Number(process.env.ELEMENT_WAIT_TIMEOUT_MS) || 10000
    },
    config: {
        primaryModel: "openai/gpt-4o-mini",
        fallbackModel: "google/gemini-flash-1.5"
    }
};

export class SettingsManager {
    static getSettings(): SystemSettings {
        const dir = path.dirname(SETTINGS_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        if (!fs.existsSync(SETTINGS_PATH)) {
            return { ...DEFAULTS };
        }
        try {
            const fileData = fs.readFileSync(SETTINGS_PATH, 'utf-8');
            const userSettings = JSON.parse(fileData);

            // Check if legacy flat structure and migrate on read? 
            // Or just merge deeply.
            // If it's old flat structure, it wont match 'queue', 'form' keys.
            // We should detect old structure and migrating it could be nice, 
            // but for now let's assume we want to enforce new structure.
            // Actually, merging with DEFAULTS handles missing keys, but if userSettings is flat, it's ignored?
            // Let's assume we simply read what matches. 
            // If the user has a flat file, it will be largely ignored and defaults used.
            // That's acceptable for a refactor request.

            return {
                queue: { ...DEFAULTS.queue, ...(userSettings.queue || {}) },
                form: { ...DEFAULTS.form, ...(userSettings.form || {}) },
                config: { ...DEFAULTS.config, ...(userSettings.config || {}) }
            };
        } catch (e) {
            console.error("Failed to read settings.json:", e);
            return DEFAULTS;
        }
    }

    static updateSettings(newSettings: Partial<SystemSettings>): SystemSettings {
        const current = this.getSettings();
        const updated: SystemSettings = {
            queue: { ...current.queue, ...(newSettings.queue || {}) },
            form: { ...current.form, ...(newSettings.form || {}) },
            config: { ...current.config, ...(newSettings.config || {}) }
        };

        if (updated.config.openaiApiKey === 'sk-****') delete updated.config.openaiApiKey;

        const dir = path.dirname(SETTINGS_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2));
        return updated;
    }
}
