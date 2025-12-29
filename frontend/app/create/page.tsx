"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const SERVER_URL = "http://localhost:3001";

interface Profile {
    id: string;
    name: string;
}


interface Action {
    type: string;
    selector: string;
    value?: string;
}

interface Template {
    id: string;
    url: string;
    name?: string;
    updated_at: string;
    actions: Action[];
    cached?: boolean;
}

export default function CreateJobPage() {
    const router = useRouter();
    const [url, setUrl] = useState("");
    const [formName, setFormName] = useState("");
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedProfile, setSelectedProfile] = useState("");
    const [customData, setCustomData] = useState("");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

    // Rename State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    // Fetch Profiles & Templates
    const fetchTemplates = () => {
        fetch(`${SERVER_URL}/templates`, { credentials: 'include' })
            .then((res) => res.json())
            .then((data) => {
                setTemplates(data);
            })
            .catch((err) => console.error("Failed to fetch templates:", err));
    };

    useEffect(() => {
        // Profiles
        fetch(`${SERVER_URL}/profiles`, { credentials: 'include' })
            .then((res) => res.json())
            .then((data) => {
                setProfiles(data);
                if (data.length > 0) setSelectedProfile(data[0].id);
            })
            .catch((err) => console.error("Failed to fetch profiles:", err));

        // Templates (History)
        fetchTemplates();
    }, []);

    const handleHistoryClick = (tpl: Template) => {
        setPreviewTemplate(tpl);
    };

    const handleApply = () => {
        if (!previewTemplate) return;

        setUrl(previewTemplate.url);
        // Use custom name if available, otherwise generate default
        if (previewTemplate.name) {
            setFormName(previewTemplate.name);
        } else {
            try {
                const domain = new URL(previewTemplate.url).hostname.replace('www.', '');
                const path = new URL(previewTemplate.url).pathname.replace(/\//g, ' ').trim();
                setFormName(`Replay: ${domain} ${path}`.trim());
            } catch { }
        }
    };

    const startEditing = (e: React.MouseEvent, tpl: Template) => {
        e.stopPropagation(); // Prevent preview click
        setEditingId(tpl.id);
        setEditName(tpl.name || "");
    };

    const saveName = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            const res = await fetch(`${SERVER_URL}/templates/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName }),
                credentials: 'include'
            });
            if (res.ok) {
                setEditingId(null);
                fetchTemplates(); // Refresh list
            }
        } catch (err) {
            console.error("Failed to update name", err);
        }
    };

    const deleteTemplate = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this cached form?")) return;

        try {
            const res = await fetch(`${SERVER_URL}/templates/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                fetchTemplates(); // Refresh list
                if (previewTemplate?.id === id) setPreviewTemplate(null);
            }
        } catch (err) {
            console.error("Failed to delete template", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url || !selectedProfile) return;

        setLoading(true);
        setStatus("Submitting...");

        try {
            const formData = new FormData();
            formData.append("url", url);
            formData.append("form_name", formName || "Untitled Task");
            formData.append("profile_id", selectedProfile);

            let parsedCustomData = {};
            if (customData.trim()) {
                try {
                    parsedCustomData = JSON.parse(customData);
                } catch {
                    parsedCustomData = { "extra_info": customData };
                }
            }
            formData.append("custom_data", JSON.stringify(parsedCustomData));

            if (files.length > 0) {
                files.forEach(f => formData.append("files", f));
            }

            const res = await fetch(`${SERVER_URL}/jobs`, {
                method: "POST",
                body: formData,
                credentials: 'include'
            });

            const data = await res.json();
            if (res.ok) {
                setStatus(`Success: Job Submitted! ID: ${data.id}`);
                setTimeout(() => {
                    router.push('/');
                }, 1500);
            } else {
                setStatus(`Error: ${data.error}`);
            }
        } catch (err) {
            if (err instanceof Error) {
                setStatus(`Error: Network Error: ${err.message}`);
            } else {
                setStatus(`Error: Network Error: Unknown error`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto pt-10 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">New Automation Task</h1>
                <p className="text-gray-400">Configure a new AI agent to handle a form submission.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* LEFT COLUMN: FORM */}
                <div className="lg:col-span-2 glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
                    {/* Decorative Blur */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -z-10"></div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Task Name</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="e.g. Weekly Report Submission"
                                    className="glass-input w-full px-4 py-3 rounded-xl text-sm placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Target URL</label>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://site.com/form..."
                                    required
                                    className="glass-input w-full px-4 py-3 rounded-xl text-sm placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">User Profile</label>
                            <div className="relative">
                                <select
                                    value={selectedProfile}
                                    onChange={(e) => setSelectedProfile(e.target.value)}
                                    className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white appearance-none cursor-pointer bg-black/20 hover:bg-black/30 transition-colors"
                                >
                                    {profiles.map((p) => (
                                        <option key={p.id} value={p.id} className="bg-gray-900 text-white py-2">
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Custom Data (JSON Context)</label>
                            <textarea
                                value={customData}
                                onChange={(e) => setCustomData(e.target.value)}
                                placeholder='Optionally provide extra context like: {"Address": "123 Main St"}'
                                className="glass-input w-full px-4 py-3 rounded-xl text-sm h-32 placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Supporting Documents</label>

                            {/* Upload Area */}
                            <div className="relative border border-dashed border-white/10 bg-white/5 rounded-xl p-6 hover:bg-white/10 transition-all text-center cursor-pointer group mb-4">
                                <input
                                    type="file"
                                    multiple
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            const newFiles = Array.from(e.target.files);
                                            // Avoid duplicates based on name + size
                                            setFiles(prev => {
                                                const existing = new Set(prev.map(f => `${f.name}-${f.size}`));
                                                const unique = newFiles.filter(f => !existing.has(`${f.name}-${f.size}`));
                                                return [...prev, ...unique];
                                            });
                                            // Reset input to allow selecting same file again if deleted
                                            e.target.value = "";
                                        }
                                    }}
                                />
                                <div className="flex flex-col items-center gap-2">
                                    <div className="p-3 rounded-full bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                    </div>
                                    <div className="text-sm text-gray-400 group-hover:text-gray-300">
                                        Click to add files (PDF, DOCX, IMG)
                                    </div>
                                </div>
                            </div>

                            {/* File List */}
                            {files.length > 0 && (
                                <div className="space-y-2 animate-fadeIn">
                                    {files.map((file, idx) => (
                                        <div key={`${file.name}-${idx}`} className="flex items-center justify-between bg-white/5 px-4 py-3 rounded-lg border border-white/5 hover:border-white/10 transition-all group">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="p-2 rounded bg-blue-500/20 text-blue-400">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm text-gray-200 truncate font-medium">{file.name}</span>
                                                    <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Remove file"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-4 rounded-xl font-bold text-white shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] ${loading
                                    ? "bg-gray-700 cursor-not-allowed opacity-50"
                                    : "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-blue-900/20"
                                    }`}
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Starting Agent...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <span>Launch Automation</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    </form>
                    {status && (
                        <div className={`mt-6 p-4 rounded-xl text-sm border backdrop-blur-md animate-in slide-in-from-bottom-2 flex items-center gap-3 ${status.startsWith("Success")
                            ? "bg-green-500/10 border-green-500/20 text-green-300"
                            : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
                            {status.startsWith("Success") ? (
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                            <span>{status.replace(/^(Success:|Error:)/, '').trim()}</span>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: HISTORY */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10 shadow-xl h-full col-span-1 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        Quick Replay
                    </h3>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 mb-6">
                        {templates.length === 0 ? (
                            <div className="text-xs text-gray-500 italic p-4 bg-white/5 rounded-xl border border-dashed border-white/10 text-center">
                                No cached forms yet. <br /> Run your first job to see it here!
                            </div>
                        ) : (
                            templates.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => handleHistoryClick(t)}
                                    className={`p-3 border rounded-xl cursor-pointer transition-all group hover:scale-[1.02] relative ${(previewTemplate?.id === t.id)
                                        ? "bg-white/10 border-blue-500/50 shadow-lg shadow-blue-500/10"
                                        : "bg-white/5 hover:bg-white/10 border-white/5 hover:border-blue-500/30"
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        {t.cached && (
                                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                Cached
                                            </span>
                                        )}
                                        <span className="text-[10px] text-gray-500">{new Date(t.updated_at).toLocaleDateString()}</span>
                                    </div>

                                    {/* Name & Edit Button */}
                                    <div className="flex items-center justify-between gap-2">
                                        {editingId === t.id ? (
                                            <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    className="bg-black/50 border border-blue-500/50 rounded px-2 py-0.5 text-xs text-white w-full focus:outline-none"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={(e) => saveName(e, t.id)}
                                                    className="p-1 px-2 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded text-[10px]"
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 group/edit w-full overflow-hidden">
                                                <div className={`text-sm font-medium truncate transition-colors flex-grow flex items-center gap-2 ${previewTemplate?.id === t.id ? "text-blue-300" : "text-gray-200 group-hover:text-blue-300"
                                                    }`}>
                                                    <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-50 group-hover:opacity-100 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {t.name || t.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                                                </div>
                                                <button
                                                    onClick={(e) => startEditing(e, t)}
                                                    className="opacity-0 group-hover/edit:opacity-100 p-1 hover:bg-white/10 rounded transition-all text-gray-400 hover:text-white"
                                                    title="Rename"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                                </button>
                                                <button
                                                    onClick={(e) => deleteTemplate(e, t.id)}
                                                    className="opacity-0 group-hover/edit:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all text-gray-400 hover:text-red-400"
                                                    title="Delete"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-[10px] text-gray-500 truncate mt-0.5">{t.url}</div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* DATA PREVIEW & APPLY SECTION */}
                    {previewTemplate && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 flex-grow flex flex-col">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Preview</h4>
                                <button
                                    onClick={handleApply}
                                    type="button"
                                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                                >
                                    <span>Apply to Form</span>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                </button>
                            </div>

                            <div className="bg-black/20 rounded-xl p-3 border border-white/5 text-xs text-gray-400 max-h-[300px] overflow-y-auto custom-scrollbar flex-grow">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-white/10 text-gray-600">
                                            <th className="pb-1">Field / Selector</th>
                                            <th className="pb-1">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {(previewTemplate.actions || []).filter(a => a.type === 'fill' || a.type === 'upload').map((action, idx) => (
                                            <tr key={idx} className="group hover:bg-white/5">
                                                <td className="py-1.5 pr-2 font-mono text-gray-500 truncate max-w-[100px]" title={action.selector}>
                                                    {action.selector.replace(/[.#]/g, '')}
                                                </td>
                                                <td className="py-1.5 text-blue-300 truncate max-w-[120px]" title={action.value}>
                                                    {action.value}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="mt-2 text-center text-[10px] text-gray-600">
                                    Total {(previewTemplate.actions || []).length} actions stored
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
