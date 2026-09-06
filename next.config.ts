import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives inside a larger repo that has its own lockfile. Pin the root
  // so Next does not infer the parent directory and warn on every build.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
