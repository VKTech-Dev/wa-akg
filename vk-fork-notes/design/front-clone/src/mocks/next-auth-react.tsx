"use client";
// Stub de next-auth/react: sempre "logado" como administrador de demonstração.
import type { ReactNode } from "react";
import { ME } from "./data";

export type MockSession = { user: { id: string; name: string; email: string; role: string }; expires: string };

const SESSION: MockSession = { user: ME, expires: "2099-01-01T00:00:00.000Z" };

export function SessionProvider({ children }: { children: ReactNode; [k: string]: unknown }) {
    return <>{children}</>;
}

export function useSession(): { data: MockSession; status: "authenticated"; update: () => Promise<MockSession> } {
    return { data: SESSION, status: "authenticated", update: async () => SESSION };
}

export async function signIn(_provider?: string, _options?: Record<string, unknown>) {
    // o login do clone sempre "funciona": segue para o dashboard
    if (typeof window !== "undefined") window.location.href = "/dashboard";
    return { error: undefined, ok: true, status: 200, url: "/dashboard" };
}

export async function signOut(options?: { callbackUrl?: string }) {
    if (typeof window !== "undefined") window.location.href = options?.callbackUrl || "/auth/login";
}
