import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@pivotaledge/workflows",
    "@pivotaledge/evals",
    "@pivotaledge/kg",
    "@pivotaledge/models",
    "@pivotaledge/scoring",
    "@pivotaledge/schemas",
  ],
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
