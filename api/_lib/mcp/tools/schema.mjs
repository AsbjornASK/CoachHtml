// Shared JSON-schema pieces and date defaults for tool definitions.

import { daysAgo } from '../../util.mjs';

export const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Date as YYYY-MM-DD' };

export const oldest = days => ({ ...date, description: `First date, YYYY-MM-DD (default: ${days} days ago)` });
export const newest = { ...date, description: 'Last date, inclusive, YYYY-MM-DD (default: today)' };

export const dryRun = {
  type: 'boolean',
  description: 'Default true: only show what would change (before/after). Set false to apply the change.',
};

export const verbose = { type: 'boolean', description: 'Return the raw Intervals objects (null fields still removed). Default false.' };

export const sportType = {
  type: 'string',
  description: 'Activity type, e.g. Run, Ride, VirtualRide, WeightTraining. Run also covers VirtualRun/TrailRun and Ride covers VirtualRide etc.',
};

export const obj = (properties, required) => ({ type: 'object', properties, ...(required && { required }) });

// Resolves oldest/newest with defaults relative to today.
export const range = (a, days, today) => ({
  oldest: a.oldest ?? daysAgo(days, today),
  newest: a.newest ?? daysAgo(0, today),
});
