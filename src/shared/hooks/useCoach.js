import { useFetch } from './useFetch'

// Fetches today's readiness, rings and wellness from /api/get-coach.
// Returns { data: { readiness, rings, wellness, … }, loading, error, refetch }
export function useCoach() {
  return useFetch('/api/get-coach')
}
