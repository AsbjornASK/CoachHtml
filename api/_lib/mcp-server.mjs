// Minimal stateless MCP server (Streamable HTTP, JSON responses) exposing Intervals.icu as tools.

import { activityTools } from './mcp/tools/activities.mjs';
import { analysisTools } from './mcp/tools/analysis.mjs';
import { eventTools } from './mcp/tools/events.mjs';
import { settingsTools } from './mcp/tools/settings.mjs';
import { wellnessTools } from './mcp/tools/wellness.mjs';

const SERVER_INFO = { name: 'coach-intervals', version: '2.0.0' };
const DEFAULT_PROTOCOL = '2025-06-18';

const INSTRUCTIONS = `Training, wellness and settings for one athlete from Intervals.icu.
Units: durations in seconds (also shown as m:ss), distances in meters (km where named), speed in m/s (pace shown as min/km), power in watts, HR in bpm.
Running is mostly on a treadmill and trained by HR zones: HR is the primary intensity measure, pace/distance are watch estimates.
Wellness HRV: use \`hrv\` (Garmin, overnight) for readiness; \`hrvSDNN\` (Apple, daytime) is a different measure.
Every tool that changes or deletes data defaults to dry_run=true and only shows the change; show it to the user and call again with dry_run=false only after they confirm.`;

export const TOOLS = [...wellnessTools, ...settingsTools, ...activityTools, ...analysisTools, ...eventTools];

const text = (data, isError = false) => ({
  content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data) }],
  ...(isError && { isError: true }),
});

async function callTool(client, params, today) {
  const tool = TOOLS.find(t => t.name === params?.name);
  if (!tool) return { error: { code: -32602, message: `Unknown tool: ${params?.name}` } };
  const args = params.arguments ?? {};
  for (const k of tool.inputSchema.required ?? []) {
    if (args[k] == null) return { result: text(`Missing argument: ${k}`, true) };
  }
  try {
    return { result: text((await tool.run(client, args, today)) ?? { ok: true }) };
  } catch (e) {
    return { result: text(e.message || 'Request failed', true) };
  }
}

// Handles one JSON-RPC message; returns the response object, or null for notifications.
export async function handleMessage(msg, client, today = new Date()) {
  const { id, method, params } = msg ?? {};
  if (id === undefined || id === null) return null;

  let out;
  switch (method) {
    case 'initialize':
      out = { result: {
        protocolVersion: params?.protocolVersion ?? DEFAULT_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      } };
      break;
    case 'ping':
      out = { result: {} };
      break;
    case 'tools/list':
      out = { result: { tools: TOOLS.map(({ run, ...t }) => t) } };
      break;
    case 'tools/call':
      out = await callTool(client, params, today);
      break;
    default:
      out = { error: { code: -32601, message: `Method not found: ${method}` } };
  }
  return { jsonrpc: '2.0', id, ...out };
}
