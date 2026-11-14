import { useFetch } from './useFetch'

// Fetches 150-day session list (load, RPE, heart rate, zones) from /api/get-sport-load.
// Returns { data: { sessions, today }, loading, error, refetch }
export function useSportLoad() {
  return useFetch('/api/get-sport-load')
}
