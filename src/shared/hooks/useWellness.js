import { useState, useCallback } from 'react'

// Submits wellness updates to /api/update-wellness (POST). Each payload needs a `date`.
// Returns { submit, loading, error, success }.
export function useWellness() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Accepts one payload or a list; a list is sent in order and succeeds only if all do.
  const submit = useCallback(async (payloads) => {
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      for (const payload of [].concat(payloads)) {
        const res = await fetch('/api/update-wellness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          // Keep Intervals' own explanation: without it a rejected save can't be diagnosed
          const details = typeof body.details === 'string' ? body.details.slice(0, 300) : ''
          throw new Error([`${body.error ?? 'Save failed'} (HTTP ${res.status}, ${payload.date ?? 'no date'})`, details].filter(Boolean).join(': '))
        }
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
