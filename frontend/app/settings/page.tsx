"use client";

import { useState, useEffect, useCallback } from "react";
import { Database, Cpu, Info } from "lucide-react";

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

            </div>
        </div>
    );
}
