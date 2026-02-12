# Minimal Agent POC for MeetingFlow Agent API

## Prerequisites
- Running Next.js dev server on `http://localhost:3000`
- `AGENT_API_KEY` set in `.env.local`

## Endpoints Used
- `POST /api/agent/analyze`
- `GET /api/agent/health`

## Run
- Step 3.2 will add `agent/run.ts`

## MCP Server
- Prerequisites: API running (`npm run dev`) and `AGENT_API_KEY` set.
- Compile:
  - `npx tsc agent/mcp-server.ts --target ES2022 --module Node16 --moduleResolution Node16 --outDir agent/dist`
- Run:
  - `node agent/dist/mcp-server.js`
- Tool name:
  - `analyze_meetings`
