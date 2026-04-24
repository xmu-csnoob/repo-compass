import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { PipelineCache } from "./cache.js";
import { registerAllTools } from "./tools.js";

/**
 * Create the McpServer, register all 7 tools, connect via stdio transport,
 * and start listening.
 *
 * The server runs until the process receives SIGINT or SIGTERM.
 */
export async function createAndStartServer(): Promise<void> {
  const cache = new PipelineCache();

  const server = new McpServer({
    name: "repo-compass",
    version: "0.1.0",
  });

  registerAllTools(server, cache);

  const cleanup = (): void => {
    cache.clear();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
