// JSON calls to Intervals.icu for the MCP tools, with readable errors.

export class ApiError extends Error {
  constructor(status, body, path) {
    super(explain(status, body, path));
    this.status = status;
  }
}

function explain(status, body, path) {
  const detail = body ? `: ${String(body).slice(0, 300)}` : '';
  if (status === 401 || status === 403) return `Intervals refused access (${status}). Check the API key and athlete id${detail}`;
  if (status === 404) return `Not found in Intervals (${path}). Check the id or date`;
  if (status === 429) return 'Intervals rate limit reached, even after one retry. Wait a minute and try again';
  if (status >= 500) return `Intervals had a server error (${status}). Try again shortly${detail}`;
  return `Intervals rejected the request (${status})${detail}`;
}

async function parse(res, path) {
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, text, path);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export const getJson = async (c, path) => parse(await c.get(path), path);
export const send    = async (c, method, path, body) => parse(await c.request(method, path, body), path);

// Builds a query string, skipping empty values and joining arrays with commas.
export function qs(params) {
  const parts = Object.entries(params)
    .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
