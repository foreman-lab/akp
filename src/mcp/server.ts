import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  briefKnowledge,
  describeKnowledgeBase,
  getFreshness,
  getNeighbors,
  getObject,
  lookupKnowledge,
} from "../query/query-knowledge-base.js";

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: "akp",
    version: "0.1.0-alpha.0",
  });

  server.registerTool(
    "akp.describe",
    {
      title: "Describe AKP",
      description: "Describe the active Artifact Knowledge Base schema and capabilities.",
    },
    async () => jsonResult(await describeKnowledgeBase()),
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
    async ({ intent, limit }) => jsonResult(await lookupKnowledge(intent, limit)),
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
    async ({ id }) => jsonResult(await getObject(id)),
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
    async ({ id, limit }) => jsonResult(await getNeighbors(id, limit)),
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
    async ({ scope, limit }) => jsonResult(await briefKnowledge(scope, limit)),
  );

  server.registerTool(
    "akp.freshness",
    {
      title: "Check AKP Freshness",
      description: "Summarize freshness status for the local AKP store.",
    },
    async () => jsonResult(await getFreshness()),
  );

  await server.connect(new StdioServerTransport());
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
