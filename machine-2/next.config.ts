import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  ...(process.env.GITHUB_ACTIONS
    ? { basePath: "/CSARCH2ComputingMachine2", assetPrefix: "/CSARCH2ComputingMachine2/" }
    : {}),
};

export default nextConfig;
