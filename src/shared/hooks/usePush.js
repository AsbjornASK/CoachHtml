import { useState, useEffect, useCallback } from 'react'

// Manages push notification subscription against /api/push-subscribe.
// Returns { enabled, publicKey, loading, error, toggle, sendTest }
export function usePush() {
  const [enabled, setEnabled] = useState(false)
  const [publicKey, setPublicKey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/push-subscribe')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(({ publicKey: pk, endpoint }) => {
        setPublicKey(pk)
        setEnabled(!!endpoint)
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  const toggle = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Push notifications not supported in this browser')
      return
    }
    setError(null)
    try {
      if (enabled) {
        await fetch('/api/push-subscribe', { method: 'DELETE' })
        setEnabled(false)
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') throw new Error('Permission denied')
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
        const { endpoint, keys } = sub.toJSON()
        const res = await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint, keys }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setEnabled(true)
      }
    } catch (err) {
      setError(err.message ?? 'Push error')
    }
  }, [enabled, publicKey])

  const sendTest = useCallback(async () => {
    const res = await fetch('/api/push-test', { method: 'POST' })
    if (!res.ok) setError(`Test failed: HTTP ${res.status}`)
  }, [])

  return { enabled, publicKey, loading, error, toggle, sendTest }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
