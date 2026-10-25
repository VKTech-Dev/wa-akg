import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// CLONE: sem servidor. next-auth/react vira o stub de src/mocks (camada simulada).
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: { "next-auth/react": "./src/mocks/next-auth-react.tsx" },
  },
};

export default withNextIntl(nextConfig);
