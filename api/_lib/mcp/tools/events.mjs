// Calendar events: planned workouts, races and notes.

import { getJson, qs, send } from '../api.mjs';
import { compact, diff, dryRunReply, mmss } from '../format.mjs';
import { daysAgo } from '../../util.mjs';
import { date, dryRun, obj } from './schema.mjs';

const eventView = e => compact({
  id: e.id, date: e.start_date_local?.slice(0, 10), category: e.category, type: e.type, name: e.name,
  description: e.description, duration: mmss(e.moving_time), moving_time: e.moving_time,
  load: e.icu_training_load, distance_m: e.distance,
});

const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] != null).map(k => [k, o[k]]));

export const eventTools = [
  {
    name: 'get_events',
    description: 'Calendar events: planned workouts, races, notes. Defaults to today and the next 14 days.',
    inputSchema: obj({
      oldest: { ...date, description: 'First date (default: today)' },
      newest: { ...date, description: 'Last date (default: 14 days ahead)' },
      category: { type: 'string', description: 'Optional filter, e.g. WORKOUT, RACE_A, RACE_B, RACE_C, NOTE' },
    }),
    run: async (c, a, today) => (await getJson(c, `/events${qs({
      oldest: a.oldest ?? daysAgo(0, today), newest: a.newest ?? daysAgo(-14, today), category: a.category,
    })}`) ?? []).map(eventView),
  },
  {
    name: 'create_event',
    description: 'Add a planned workout, race or note to the calendar. For workouts, put structured steps in description using Intervals workout syntax (e.g. "- 10m Z2\\n3x\\n- 4m Z4\\n- 3m Z1"). moving_time in seconds. dry_run defaults to true.',
    inputSchema: obj({
      date,
      name: { type: 'string' },
      category: { type: 'string', description: 'WORKOUT (default), RACE_A, RACE_B, RACE_C or NOTE' },
      type: { type: 'string', description: 'Sport, e.g. Run, Ride, Swim, WeightTraining' },
      description: { type: 'string', description: 'Notes or workout steps' },
      moving_time: { type: 'integer', description: 'Planned duration in seconds' },
      load: { type: 'number', description: 'Planned training load' },
      dry_run: dryRun,
    }, ['date', 'name']),
    run: async (c, a) => {
      const body = {
        start_date_local: `${a.date}T00:00:00`,
        category: a.category ?? 'WORKOUT',
        name: a.name,
        ...pick(a, ['type', 'description', 'moving_time']),
        ...(a.load != null && { icu_training_load: a.load }),
      };
      if (a.dry_run !== false) return dryRunReply('create event', { event: eventView(body) });
      return { applied: true, event: eventView(await send(c, 'POST', '/events', body)) };
    },
  },
  {
    name: 'update_event',
    description: 'Change a calendar event by id (from get_events). Only the given fields change; date moves the event. dry_run defaults to true.',
    inputSchema: obj({
      id: { type: 'integer' }, date,
      name: { type: 'string' }, type: { type: 'string' }, description: { type: 'string' },
      moving_time: { type: 'integer', description: 'Seconds' },
      dry_run: dryRun,
    }, ['id']),
    run: async (c, a) => {
      const change = {
        ...pick(a, ['name', 'type', 'description', 'moving_time']),
        ...(a.date && { start_date_local: `${a.date}T00:00:00` }),
      };
      const current = await getJson(c, `/events/${a.id}`);
      const changes = diff(current, change);
      if (a.dry_run !== false) return dryRunReply(`update event ${a.id}`, { event: eventView(current), changes });
      return { applied: true, changes, event: eventView(await send(c, 'PUT', `/events/${a.id}`, change)) };
    },
  },
  {
    name: 'delete_event',
    description: 'Delete a calendar event by id (from get_events). dry_run defaults to true.',
    inputSchema: obj({ id: { type: 'integer' }, dry_run: dryRun }, ['id']),
    run: async (c, a) => {
      const current = await getJson(c, `/events/${a.id}`);
      if (a.dry_run !== false) return dryRunReply(`delete event ${a.id}`, { event: eventView(current) });
      await send(c, 'DELETE', `/events/${a.id}`);
      return { applied: true, deleted: eventView(current) };
    },
  },
];
