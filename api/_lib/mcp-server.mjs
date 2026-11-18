// Minimal stateless MCP server (Streamable HTTP, JSON responses) exposing Intervals.icu as tools.

import { daysAgo } from './util.mjs';

const SERVER_INFO = { name: 'coach-intervals', version: '1.0.0' };
const DEFAULT_PROTOCOL = '2025-06-18';

const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Date as YYYY-MM-DD' };
const range = (defaultDays, extra = {}) => ({
  type: 'object',
  properties: {
    oldest: { ...date, description: `First date, YYYY-MM-DD (default: ${defaultDays} days ago)` },
    newest: { ...date, description: 'Last date, YYYY-MM-DD (default: today)' },
    ...extra,
  },
});

// Activity fields kept in list results; get_activity returns everything.
const ACTIVITY_FIELDS = [
  'id', 'start_date_local', 'type', 'name', 'moving_time', 'elapsed_time', 'distance',
  'total_elevation_gain', 'average_speed', 'average_heartrate', 'max_heartrate',
  'icu_average_watts', 'icu_weighted_avg_watts', 'icu_training_load', 'icu_intensity',
  'trimp', 'calories', 'perceived_exertion', 'feel', 'description',
];
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] != null).map(k => [k, o[k]]));

const rangeQuery = (args, defaultDays, today) =>
  `oldest=${args.oldest ?? daysAgo(defaultDays, today)}&newest=${args.newest ?? daysAgo(0, today)}`;

export const TOOLS = [
  {
    name: 'get_athlete',
    description: 'Athlete profile from Intervals.icu, including sport settings (FTP, threshold HR/pace, zones).',
    inputSchema: { type: 'object', properties: {} },
    run: c => c.get(''),
  },
  {
    name: 'get_wellness',
    description: 'Daily wellness records: HRV, resting HR, sleep, weight, body fat, fitness (ctl), fatigue (atl), ramp rate, and subjective scores (soreness, fatigue, stress, mood, motivation, 1-4 scale where 1 is best).',
    inputSchema: range(14),
    run: (c, a, today) => c.get(`/wellness?${rangeQuery(a, 14, today)}`),
  },
  {
    name: 'update_wellness',
    description: 'Write wellness fields for one day. Common fields: weight, bodyFat, restingHR, hrv, sleepSecs, sleepScore, sleepQuality, soreness, fatigue, stress, mood, motivation, injury (subjective 1-4, 1 is best), comments.',
    inputSchema: {
      type: 'object',
      properties: { date, fields: { type: 'object', description: 'Wellness fields to set', additionalProperties: true } },
      required: ['date', 'fields'],
    },
    run: (c, a) => c.put(`/wellness/${a.date}`, { ...a.fields, id: a.date }),
  },
  {
    name: 'get_activities',
    description: 'Completed activities in a date range, with key metrics (duration in seconds, distance in meters, load, HR, power).',
    inputSchema: range(14),
    run: async (c, a, today) => {
      const res = await c.get(`/activities?${rangeQuery(a, 14, today)}`);
      return res.ok ? (await res.json()).map(x => pick(x, ACTIVITY_FIELDS)) : res;
    },
  },
  {
    name: 'get_activity',
    description: 'All details for one activity by id (e.g. "i12345678"), optionally with its intervals/laps.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Activity id' },
        intervals: { type: 'boolean', description: 'Include the interval breakdown' },
      },
      required: ['id'],
    },
    run: (c, a) => c.get(`~/activity/${encodeURIComponent(a.id)}${a.intervals ? '?intervals=true' : ''}`),
  },
  {
    name: 'get_events',
    description: 'Calendar events: planned workouts, races, notes. Defaults to today and the next 14 days.',
    inputSchema: {
      type: 'object',
      properties: {
        oldest: { ...date, description: 'First date (default: today)' },
        newest: { ...date, description: 'Last date (default: 14 days ahead)' },
        category: { type: 'string', description: 'Optional filter, e.g. WORKOUT, RACE_A, RACE_B, RACE_C, NOTE' },
      },
    },
    run: (c, a, today) => {
      const q = `oldest=${a.oldest ?? daysAgo(0, today)}&newest=${a.newest ?? daysAgo(-14, today)}`;
      return c.get(`/events?${q}${a.category ? `&category=${encodeURIComponent(a.category)}` : ''}`);
    },
  },
  {
    name: 'create_event',
    description: 'Add a planned workout, race or note to the Intervals.icu calendar. For workouts, put the structured steps in description using Intervals workout syntax (e.g. "- 10m Z2\\n3x\\n- 4m Z4\\n- 3m Z1").',
    inputSchema: {
      type: 'object',
      properties: {
        date,
        name: { type: 'string' },
        category: { type: 'string', description: 'WORKOUT (default), RACE_A, RACE_B, RACE_C or NOTE' },
        type: { type: 'string', description: 'Sport, e.g. Run, Ride, Swim, WeightTraining' },
        description: { type: 'string', description: 'Notes or workout steps' },
        moving_time: { type: 'integer', description: 'Planned duration in seconds' },
        load: { type: 'number', description: 'Planned training load' },
      },
      required: ['date', 'name'],
    },
    run: (c, a) => c.request('POST', '/events', {
      start_date_local: `${a.date}T00:00:00`,
      category: a.category ?? 'WORKOUT',
      name: a.name,
      ...pick(a, ['type', 'description', 'moving_time']),
      ...(a.load != null && { icu_training_load: a.load }),
    }),
  },
  {
    name: 'update_event',
    description: 'Change a calendar event by id (from get_events). Only the given fields change; date moves the event.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        date,
        name: { type: 'string' },
        type: { type: 'string' },
        description: { type: 'string' },
        moving_time: { type: 'integer' },
      },
      required: ['id'],
    },
    run: (c, a) => c.request('PUT', `/events/${a.id}`, {
      ...pick(a, ['name', 'type', 'description', 'moving_time']),
      ...(a.date && { start_date_local: `${a.date}T00:00:00` }),
    }),
  },
  {
    name: 'delete_event',
    description: 'Delete a calendar event by id (from get_events).',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
    run: (c, a) => c.request('DELETE', `/events/${a.id}`),
  },
];

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
    const out = await tool.run(client, args, today);
    if (!(out instanceof Response)) return { result: text(out) };
    const body = await out.text();
    if (!out.ok) return { result: text(`Intervals API error ${out.status}: ${body}`, true) };
    return { result: text(body || { ok: true }) };
  } catch (e) {
    return { result: text(`Request failed: ${e.message}`, true) };
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
        instructions: 'Training and wellness data for one athlete from Intervals.icu. Durations are seconds, distances meters.',
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
