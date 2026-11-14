import { useFetch } from './useFetch'

// Fetches 90-day wellness series, HRV bands and calendar events from /api/get-dashboard.
// Returns { data: { series, bands, today }, loading, error, refetch }
export function useDashboard() {
  return useFetch('/api/get-dashboard')
}
