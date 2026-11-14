import { useState, useCallback } from 'react'

// Submits a wellness check-in to /api/update-wellness (POST).
// Returns { submit, loading, error, success }.
export function useWellness() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const submit = useCallback(async (payload) => {
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/update-wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setSuccess(true)
    } catch (err) {
      setError(err.message ?? 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  return { submit, loading, error, success }
}
