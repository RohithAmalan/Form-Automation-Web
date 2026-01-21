"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    // Use startsWith to cover /login/ as well if it happens
    const isLoginPage = pathname === '/login' || pathname?.startsWith('/login/');

    if (isLoginPage) {
        return (
            <main className="min-h-screen w-full bg-[#050511]">
                {children}
            </main>
        );
    }

    return (
        <>
            <Sidebar />
            {/* Main Content Area: Offset by sidebar width */}
            <main className="flex-1 ml-64 min-h-screen p-8 bg-[#050511]">
                {children}
            </main>
        </>
    );
}
