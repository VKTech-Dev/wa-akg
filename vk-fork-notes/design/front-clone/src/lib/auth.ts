// CLONE (simulado): sempre logado como administrador de demonstração.
import { ME } from "@/mocks/data";

export async function auth() {
    return { user: ME, expires: "2099-01-01T00:00:00.000Z" };
}
