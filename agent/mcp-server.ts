import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const apiUrl = process.env.AGENT_API_URL ?? "http://localhost:3000";
const apiKey = process.env.AGENT_API_KEY;

if (!apiKey) {
  console.error("Missing AGENT_API_KEY. Set it before starting the MCP server.");
  process.exit(1);
}

const server = new McpServer({ name: "meetingflow", version: "0.1.0" });

server.registerTool(
  "analyze_meetings",
  {
    description: "Analyze meeting events cost and return summary + insights.",
    inputSchema: {
      events: z.array(
        z.object({
          start: z.string(),
          end: z.string(),
          attendees: z.array(z.string()),
        })
      ),
      days: z.number().optional(),
      roleByPersonEmail: z.record(z.string(), z.string()).optional(),
    },
  },
  async ({ events, days, roleByPersonEmail }) => {
    const response = await fetch(`${apiUrl}/api/agent/analyze`, {
      method: "POST",
      headers: {
        Authorization: `Api-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ events, days, roleByPersonEmail }),
    });

    const body = await response.text();
    if (!response.ok) {
      return { content: [{ type: "text", text: `Error ${response.status}: ${body}` }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(JSON.parse(body), null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MeetingFlow MCP Server running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

