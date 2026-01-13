"use client";

import { useState, useEffect, useCallback } from "react";
import { Database, Cpu, Info, ChevronDown, ChevronUp } from "lucide-react";

const SERVER_URL = "http://localhost:3001";

interface HealthStatus {
    db: string;
    ai: string;
    version?: string;
}

export default function SettingsPage() {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const checkHealth = useCallback(() => {
        setLoading(true);
        fetch(`${SERVER_URL}/settings/health`)
            .then(res => res.json())
            .then(data => {
                setHealth(data);
                setLoading(false);
            })
            .catch(() => {
                setHealth({ db: 'disconnected', ai: 'unknown' });
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            checkHealth();
        }, 0);
        return () => clearTimeout(timer);
    }, [checkHealth]);

    const clearAllData = async () => {
        if (!confirm("⚠️ ARE YOU SURE?\n\nThis will delete ALL job history and logs. This action cannot be undone.")) return;

        const userInput = prompt("Type 'DELETE' to confirm:");
        if (userInput !== 'DELETE') return;

        try {
            const res = await fetch(`${SERVER_URL}/jobs`, { method: 'DELETE' });
            if (res.ok) {
                alert("All data verified cleared.");
                window.location.reload();
            } else {
                alert("Failed to clear data.");
            }
        } catch {
            alert("Network Error");
        }
    };

    return (
        <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
            <p className="text-gray-400 mb-8">Manage system configuration and maintenance.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* System Health Panel */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">System Health</h2>
                        <button onClick={checkHealth} className="text-xs text-blue-400 hover:text-white">Refresh</button>
                    </div>

                    <div className="space-y-4">


                        {/* Database Status */}
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Database className="w-6 h-6 text-blue-400" />
                                <div>
                                    <p className="font-semibold text-white">Database</p>
                                    <p className="text-xs text-gray-400">PostgreSQL Connection</p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${health?.db === 'connected'
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                {loading ? 'Checking...' : health?.db?.toUpperCase()}
                            </div>
                        </div>

                        {/* AI Status */}
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Cpu className="w-6 h-6 text-purple-400" />
                                <div>
                                    <p className="font-semibold text-white">AI Provider</p>
                                    <p className="text-xs text-gray-400">OpenAI / OpenRouter</p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${health?.ai?.includes('configured')
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                }`}>
                                {loading ? 'Checking...' : health?.ai?.toUpperCase()}
                            </div>
                        </div>

                        {/* Version */}
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Info className="w-6 h-6 text-gray-400" />
                                <div>
                                    <p className="font-semibold text-white">Version</p>
                                    <p className="text-xs text-gray-400">Backend Server</p>
                                </div>
                            </div>
                            <span className="text-gray-400 font-mono text-sm">v{health?.version || '1.0.0'}</span>
                        </div>
                    </div>
                </div>

                {/* Data Management Panel */}
                <div className="glass-panel p-6 rounded-2xl border border-red-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-20 bg-red-500/5 blur-3xl rounded-full pointer-events-none"></div>

                    <h2 className="text-xl font-bold text-white mb-2">Danger Zone</h2>
                    <p className="text-sm text-gray-400 mb-6">Irreversible actions for data management.</p>

                    <div className="p-4 border border-red-500/20 rounded-xl bg-red-500/5 hover:bg-red-500/10 transition-colors">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-red-200">Clear All Data</h3>
                                <p className="text-xs text-red-300/60 mt-1">Deletes all jobs, logs, and history.</p>
                            </div>
                            <button
                                onClick={clearAllData}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-red-500/20 transition-all hover:scale-105"
                            >
                                DELETE ALL
                            </button>
                        </div>
                    </div>
                </div>

                {/* Configuration Panel */}
                <div className="glass-panel p-6 rounded-2xl border border-blue-500/20 md:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white">Runtime Configuration</h2>
                            <p className="text-sm text-gray-400">Updates apply to next job immediately.</p>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-gray-500/20"
                        >
                            Refresh Page
                        </button>
                    </div>

                    <ConfigurationForm />
                </div>

            </div>
        </div>
    );
}

function ConfigurationForm() {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showAI, setShowAI] = useState(false);
    const [showQueue, setShowQueue] = useState(true); // Default open
    const [showReliability, setShowReliability] = useState(true); // Default open

    useEffect(() => {
        fetch(`${SERVER_URL}/settings`)
            .then(res => res.json())
            .then(setSettings)
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (key: string, val: any) => {
        setSettings({ ...settings, [key]: val });
    };

    const handleSave = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) alert("Settings Saved!");
            else alert("Failed to save.");
        } catch { alert("Network Error"); }
    };

    if (loading) return <div className="text-gray-400">Loading settings...</div>;
    if (!settings) return <div className="text-red-400">Failed to load settings.</div>;

    return (
        <div className="space-y-8">



            {/* 1. Queue Configuration (Collapsible) */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
                <button
                    onClick={() => setShowQueue(!showQueue)}
                    className="w-full flex justify-between items-center p-4 bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-400" />
                        <span className="font-bold text-white">QUEUE SETTINGS</span>
                    </div>
                    {showQueue ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>

                {showQueue && (
                    <div className="p-6 bg-black/20 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Poll Interval */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Poll Interval (seconds)</label>
                                <input
                                    type="number"
                                    value={(settings.pollInterval || 2000) / 1000}
                                    onChange={(e) => handleChange('pollInterval', Number(e.target.value) * 1000)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white"
                                    step={0.1}
                                    min={0.5}
                                />
                                <p className="text-xs text-gray-500 mt-2">Worker loop frequency.</p>
                            </div>

                            {/* New Job Priority */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">New Job Priority</label>
                                <select
                                    value={settings.defaultPriority ?? 0}
                                    onChange={(e) => handleChange('defaultPriority', Number(e.target.value))}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white appearance-none"
                                >
                                    <option value={0}>Normal (Recommended)</option>
                                    <option value={-1}>Urgent (Top Priority)</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-2">
                                    {settings.defaultPriority === -1
                                        ? "New jobs jump to the front."
                                        : "New jobs go to the back."}
                                </p>
                            </div>

                            {/* Toggles */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col justify-center gap-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.runtimePriorityOverride ?? true}
                                        onChange={(e) => handleChange('runtimePriorityOverride', e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-700"
                                    />
                                    <span className="text-sm text-gray-300">Allow Runtime Override</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.retryEscalation ?? false}
                                        onChange={(e) => handleChange('retryEscalation', e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-700"
                                    />
                                    <span className="text-sm text-gray-300">Escalate on Retry</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.exclusivePriority ?? false}
                                        onChange={(e) => handleChange('exclusivePriority', e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-700"
                                    />
                                    <span className="text-sm text-gray-300">Exclusive Priority (Single Urgent Job)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Task Reliability & Timeouts (Collapsible) */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
                <button
                    onClick={() => setShowReliability(!showReliability)}
                    className="w-full flex justify-between items-center p-4 bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-purple-400" />
                        <span className="font-bold text-white">TASK RELIABILITY & TIMEOUTS</span>
                    </div>
                    {showReliability ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>

                {showReliability && (
                    <div className="p-6 bg-black/20 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Max Retries */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Max Retries</label>
                                <input
                                    type="number"
                                    value={settings.maxRetries}
                                    onChange={(e) => handleChange('maxRetries', Number(e.target.value))}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white"
                                />
                                <p className="text-xs text-gray-500 mt-2">Attempts before failing a job.</p>
                            </div>
                            {/* Backoff */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Retry Backoff (seconds)</label>
                                <input
                                    type="number"
                                    value={(settings.retryBackoffMs || 2000) / 1000}
                                    onChange={(e) => handleChange('retryBackoffMs', Number(e.target.value) * 1000)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white"
                                    step={0.5}
                                />
                                <p className="text-xs text-gray-500 mt-2">Wait time between retries.</p>
                            </div>
                            {/* Page Load */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Page Load (seconds)</label>
                                <input
                                    type="number"
                                    value={(settings.pageLoadTimeoutMs || 60000) / 1000}
                                    onChange={(e) => handleChange('pageLoadTimeoutMs', Number(e.target.value) * 1000)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white"
                                />
                                <p className="text-xs text-gray-500 mt-2">Wait time for website to open.</p>
                            </div>
                            {/* Element Wait */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Element Wait (seconds)</label>
                                <input
                                    type="number"
                                    value={(settings.elementWaitTimeoutMs || 10000) / 1000}
                                    onChange={(e) => handleChange('elementWaitTimeoutMs', Number(e.target.value) * 1000)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white"
                                />
                                <p className="text-xs text-gray-500 mt-2">Wait time for buttons/inputs.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 4. AI Configuration (Collapsible) */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
                <button
                    onClick={() => setShowAI(!showAI)}
                    className="w-full flex justify-between items-center p-4 bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-purple-400" />
                        <span className="font-bold text-white">AI Configuration</span>
                    </div>
                    {showAI ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>

                {showAI && (
                    <div className="p-6 bg-black/20 space-y-4 animate-in slide-in-from-top-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">OpenRouter API Key</label>
                            <input
                                type="password"
                                placeholder="sk-or-..."
                                value={settings.openaiApiKey || ""}
                                onChange={(e) => handleChange('openaiApiKey', e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">Leave blank to keep existing key. Enter new key to update.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Primary Model</label>
                                <input
                                    type="text"
                                    value={settings.primaryModel || "openai/gpt-4o-mini"}
                                    onChange={(e) => handleChange('primaryModel', e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Fallback Model</label>
                                <input
                                    type="text"
                                    value={settings.fallbackModel || "google/gemini-flash-1.5"}
                                    onChange={(e) => handleChange('fallbackModel', e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-8 pt-4 border-t border-white/10">
                <button
                    onClick={handleSave}
                    className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold text-sm shadow-xl shadow-green-500/20 transition-all hover:scale-[1.01]"
                >
                    SAVE CONFIGURATION
                </button>
            </div>
        </div>
    );
}
