"use client";

import { useState, useEffect, useCallback } from "react";

const SERVER_URL = "http://localhost:3001";

interface Profile {
    id: string;
    name: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
    created_at: string;
}

export default function ProfilesPage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
    const [formName, setFormName] = useState("");
    const [formJson, setFormJson] = useState("");

    const fetchProfiles = useCallback(() => {
        setLoading(true);
        fetch(`${SERVER_URL}/profiles`)
            .then(res => res.json())
            .then(data => {
                setProfiles(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProfiles();
        }, 0);
        return () => clearTimeout(timer);
    }, [fetchProfiles]);

    const openCreate = () => {
        setEditingProfile(null);
        setFormName("");
        setFormJson(JSON.stringify({
            "Full Name": "John Doe",
            "Email": "john@example.com",
            "City": "New York"
        }, null, 2));
        setShowModal(true);
    };

    const openEdit = (profile: Profile) => {
        setEditingProfile(profile);
        setFormName(profile.name);
        setFormJson(JSON.stringify(profile.payload, null, 2));
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this profile?")) return;
        try {
            await fetch(`${SERVER_URL}/profiles/${id}`, { method: 'DELETE' });
            fetchProfiles();
        } catch {
            alert("Failed to delete");
        }
    };

    const handleSubmit = async () => {
        try {
            const parsed = JSON.parse(formJson);

            const method = editingProfile ? 'PUT' : 'POST';
            const url = editingProfile
                ? `${SERVER_URL}/profiles/${editingProfile.id}`
                : `${SERVER_URL}/profiles`;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: formName, payload: parsed }),

            });

            if (res.ok) {
                setShowModal(false);
                fetchProfiles();
            } else {
                alert("Failed to save profile");
            }

        } catch {
            alert("Invalid JSON format");
        }
    };

    return (
        <div className="animate-in fade-in duration-500 max-w-6xl mx-auto">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Profiles</h1>
                    <p className="text-gray-400">Manage data profiles for auto-filling forms.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20 transition-all hover:scale-105 flex items-center gap-2"
                >
                    <span>➕</span> Create Profile
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : profiles.length === 0 ? (
                <div className="glass-panel p-10 flex flex-col items-center justify-center text-center">
                    <p className="text-gray-400 mb-4">No profiles found.</p>
                    <button onClick={openCreate} className="text-blue-400 underline hover:text-blue-300">Create your first profile</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {profiles.map(profile => (
                        <div key={profile.id} className="glass-panel p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-bold text-xl text-white truncate max-w-[70%]">{profile.name}</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => openEdit(profile)} className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-blue-300">Edit</button>
                                    <button onClick={() => handleDelete(profile.id)} className="text-xs px-2 py-1 bg-white/10 hover:bg-red-500/20 hover:text-red-400 rounded text-gray-400">Delete</button>
                                </div>
                            </div>

                            <div className="bg-black/40 p-3 rounded-lg overflow-hidden h-32 text-xs font-mono text-gray-400 border border-white/5 relative">
                                <pre>{JSON.stringify(profile.payload, null, 2)}</pre>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
                            </div>

                            <p className="text-xs text-gray-500 mt-4">ID: {profile.id.substring(0, 8)}...</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="glass-panel w-full max-w-3xl rounded-2xl flex flex-col max-h-[90vh] shadow-2xl border border-white/10">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">{editingProfile ? 'Edit Profile' : 'New Profile'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Profile Name</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    className="glass-input w-full px-4 py-3 rounded-xl text-white outline-none focus:border-blue-500/50 transition-colors"
                                    placeholder="e.g. My Personal Data"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2 flex justify-between">
                                    <span>Profile Data (JSON)</span>
                                    <span className="text-xs text-blue-400 cursor-help" title="Enter key-value pairs the AI should use.">Tips ⓘ</span>
                                </label>
                                <div className="relative">
                                    <textarea
                                        value={formJson}
                                        onChange={e => setFormJson(e.target.value)}
                                        className="w-full h-80 bg-[#0d1117] text-green-400 font-mono text-sm p-4 rounded-xl border border-white/10 outline-none focus:border-blue-500/50 resize-none leading-relaxed"
                                        spellCheck={false}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-white/5">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleSubmit} className="px-8 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105">Save Profile</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
