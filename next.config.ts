import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stop `next dev` writing an AGENTS.md into the repo when it detects an AI coding agent.
  agentRules: false,
};

export default nextConfig;
