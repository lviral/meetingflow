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
    console.error("tool called");
    const url = `${apiUrl}/api/agent/analyze`;
    console.error("http url:", url);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Api-Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events, days, roleByPersonEmail }),
      });

      console.error("http status:", response.status);
      const body = await response.text();
      const payload = response.ok
        ? safeParseJson(body)
        : { error: `Error ${response.status}`, details: body };

      console.error("tool returning");
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    } catch (error) {
      const payload = {
        error: "Fetch failed",
        details: error instanceof Error ? error.message : String(error),
      };
      console.error("tool returning");
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    }
  }
);

function safeParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return { raw: body };
  }
}

async function main() {
  console.error("boot ok");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MeetingFlow MCP Server running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
