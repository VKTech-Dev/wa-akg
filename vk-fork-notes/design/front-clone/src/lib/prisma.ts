// CLONE (simulado): só o que as páginas de servidor leem diretamente.
export const prisma = {
    systemConfig: {
        findUnique: async (_args?: unknown) => ({ id: "default", appName: "WA-AKG", enableRegistration: true, faviconUrl: "/favicon.ico" }),
    },
    autoReply: {
        count: async (_args?: unknown) => 4,
    },
};
