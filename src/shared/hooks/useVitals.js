import { useFetch } from './useFetch'

// Fetches 21-day vitals history (weight, VO₂ max, body comp, RHR) from /api/get-vitals.
// Returns { data: { series, latest, today }, loading, error, refetch }
export function useVitals() {
  return useFetch('/api/get-vitals')
}
