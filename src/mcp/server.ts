import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { buildContainer } from "../runtime/build-container.js";

export async function startMcpServer(): Promise<void> {
  const container = await buildContainer(process.cwd());

  const server = new McpServer({
    name: "akp",
    version: "0.1.0-alpha.23",
  });

  server.registerTool(
    "akp.describe",
    {
      title: "Describe AKP",
      description: "Describe the active Artifact Knowledge Base schema and capabilities.",
    },
    () => jsonResult(container.useCases.describe.execute()),
  );

  server.registerTool(
    "akp.lookup",
    {
      title: "Lookup AKP Knowledge",
      description: "Find AKP reference objects relevant to a natural-language intent.",
      inputSchema: {
        intent: z.string().min(1),
        limit: z.number().int().positive().max(50).default(5),
      },
    },
    ({ intent, limit }) => jsonResult(container.useCases.lookup.execute({ intent, limit })),
  );

  server.registerTool(
    "akp.get",
    {
      title: "Get AKP Object",
      description: "Get one AKP object by stable id.",
      inputSchema: {
        id: z.string().min(1),
      },
    },
    ({ id }) => jsonResult(container.useCases.get.execute({ id })),
  );

  server.registerTool(
    "akp.neighbors",
    {
      title: "Get AKP Neighbors",
      description: "Get relationship neighbors for an AKP object.",
      inputSchema: {
        id: z.string().min(1),
        limit: z.number().int().positive().max(100).default(20),
      },
    },
    ({ id, limit }) => jsonResult(container.useCases.neighbors.execute({ id, limit })),
  );

  server.registerTool(
    "akp.brief",
    {
      title: "Brief AKP Scope",
      description: "Return a compact orientation for a scope or task.",
      inputSchema: {
        scope: z.string().min(1),
        limit: z.number().int().positive().max(20).default(5),
      },
    },
    ({ scope, limit }) => jsonResult(container.useCases.brief.execute({ scope, limit })),
  );

  server.registerTool(
    "akp.freshness",
    {
      title: "Check AKP Freshness",
      description: "Summarize freshness status for the local AKP store.",
    },
    () => jsonResult(container.useCases.freshness.execute()),
  );

  const transport = new StdioServerTransport();
  // `onclose` only fires on a clean protocol close (graceful shutdown RPC or
  // explicit `transport.close()` from the SDK). On abrupt termination — parent
  // killed, stdin EOF without graceful shutdown — `onclose` does not fire and
  // the SQLite handle is reclaimed by the OS. This server is **read-only** by
  // design (no write verbs are registered above), so a missed dispose cannot
  // strand a pending write; better-sqlite3 in WAL mode also recovers cleanly
  // on the next open. If a write verb is ever added, revisit this comment and
  // wire a SIGTERM/SIGINT handler that calls `container.dispose()`.
  transport.onclose = (): void => {
    container.dispose();
  };
  await server.connect(transport);
}

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
