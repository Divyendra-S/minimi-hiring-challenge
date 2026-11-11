import type { NextConfig } from "next";

// npm checks the Node version on install only. On Node 20, better-sqlite3 crashes the server at the
// first database query, without a message (tested), so refuse to start instead.
if (Number(process.versions.node.split(".")[0]) < 22) {
  throw new Error(`This app needs Node 22 or newer; this is ${process.version}. Run \`nvm use\`.`);
}

const nextConfig: NextConfig = {
  // Stop `next dev` writing an AGENTS.md into the repo when it detects an AI coding agent.
  agentRules: false,
};

export default nextConfig;
