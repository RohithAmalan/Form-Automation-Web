
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
    id: string;
    display_name: string;
    email: string;
    photo_url: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: () => { } });

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // ALWAYS LOGGED IN (Mock)
        setUser({
            id: 'mock-user-1',
            display_name: 'Guest User',
            email: 'guest@example.com',
            photo_url: ''
        });
        setLoading(false);
    }, []);

    const logout = async () => {
        await fetch("http://localhost:3001/auth/logout", { method: "POST", credentials: 'include' });
        setUser(null);
        router.push('/login');
    };

    if (loading) {
        return <div className="min-h-screen bg-[#050511] flex items-center justify-center text-white">Loading...</div>;
    }

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
