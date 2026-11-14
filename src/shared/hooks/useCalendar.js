import { useFetch } from './useFetch'
export function useCalendar() {
  return useFetch('/api/get-calendar')
}
