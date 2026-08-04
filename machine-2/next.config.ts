import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS || false;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  
  // Set basePath ONLY when running inside GitHub Actions
  basePath: isGithubActions ? "/CSARCH2ComputingMachine2" : "",

};

export default nextConfig;
