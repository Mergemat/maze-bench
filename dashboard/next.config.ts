import type { NextConfig } from "next";

const config: NextConfig = {
  // The core package ships TypeScript source; Next compiles it.
  transpilePackages: ["@mazebench/core"],
};

export default config;
