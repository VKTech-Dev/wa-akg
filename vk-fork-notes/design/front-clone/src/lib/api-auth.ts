// CLONE (simulado): todas as sessões de demonstração são acessíveis.
import { SESSIONS } from "@/mocks/data";

export async function getAccessibleSessions(_userId: string, _role: string) {
    return SESSIONS;
}

export async function canAccessSession(_userId: string, _role: string, _sessionId: string) {
    return true;
}
