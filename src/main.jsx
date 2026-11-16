import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './shared/charts/charts.css'
import { registerSW } from 'virtual:pwa-register'

// Without this the installed app keeps running the previous deploy until it is
// opened a second time. With it, a new version reloads the page as soon as it is ready.
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
