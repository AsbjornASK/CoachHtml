# Coach App – React Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Coach HTML app to a React + Vite SPA with two distinct experiences — mobile (day-to-day) and desktop (weekly overview) — keeping all existing backend API functions unchanged.

**Architecture:** One Vite build, one Vercel deployment. `src/mobile/` and `src/desktop/` share design tokens, chart utilities, and API hooks from `src/shared/`. React Router handles routing. CSS Modules replace inline CSS. `vite-plugin-pwa` replaces the hand-written service worker.

**Tech Stack:** React 19, Vite, React Router v7, CSS Modules, vite-plugin-pwa, Vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/` — see design doc at https://claude.ai/artifact/WmJt3GwEubvMdwoxPiDVLY

---

## Global Constraints

- Design tokens: `#007aff` blue, `#f2f2f7` background, `#1c1c1e` text, `#8e8e93` secondary, `#30d158` green, `#ff3b30` red, `#ff9f0a` yellow
- Font stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif`
- Mobile max-width: `430px`, centered
- Safe-area insets must be respected (`env(safe-area-inset-bottom)`)
- No backend changes — all `api/*.mjs` files stay untouched
- Output directory: `dist` (replaces `static` as Vercel output)
- intervals.icu is the single source of truth; Coach never stores data locally

## Review Focus

- **PWA install prompt lost:** `vite-plugin-pwa` must emit a service worker at `/sw.js` with the same scope; verify `Cache-Control: no-cache` header is preserved in vercel.json — add test: Profile page renders push toggle without crashing (Task 10)
- **SPA routing 404 on hard reload:** vercel.json must rewrite all non-API routes to `/index.html`; test: navigate to `/vitals` directly returns 200 (Task 1 vercel.json check)
- **Chart canvas sizing on mobile:** SVG/canvas charts from `charts.js` assume a fixed width (`TL.W = 500`); React wrapper must pass container width — test: Chart renders without zero-width errors (Task 3)
- **Bottom nav active state:** active route must match React Router's current path, not `location.pathname` from vanilla JS — test: BottomNav marks correct link active (Task 5)
- **Push subscription on re-render:** `usePush` must not re-subscribe on every render; subscription check must be one-time on mount — test: subscribe is called at most once per mount (Task 10)

---

## File Structure

```
src/
  shared/
    tokens/
      colors.module.css         # CSS custom properties for all design tokens
      typography.module.css     # Font sizes, weights, letter-spacing
    charts/
      charts.js                 # Migrated from static/js/charts.js (ES module)
      wellness-labels.js        # Migrated from static/js/wellness-labels.js (ES module)
    hooks/
      useFetch.js               # Generic: useFetch(url) → { data, loading, error }
      useCoach.js               # GET /api/get-coach
      useDashboard.js           # GET /api/get-dashboard
      useSportLoad.js           # GET /api/get-sport-load
      useVitals.js              # GET /api/get-vitals
      useWellness.js            # POST /api/update-wellness
      usePush.js                # /api/push-subscribe + /api/push-test
    components/
      Card/
        Card.jsx                # Wrapper: white rounded card with optional title
        Card.module.css
      Ring/
        Ring.jsx                # SVG activity ring
        Ring.module.css
      TopBar/
        TopBar.jsx              # Sticky top bar with title, date, profile icon
        TopBar.module.css
      BottomNav/
        BottomNav.jsx           # Fixed bottom nav (mobile only)
        BottomNav.module.css
  mobile/
    layout/
      MobileLayout.jsx          # Wraps pages with TopBar + BottomNav
      MobileLayout.module.css
    pages/
      Home/
        Home.jsx                # Readiness, rings, physio metrics
        Home.module.css
      Checkin/
        Checkin.jsx             # Wellness logging form
        Checkin.module.css
      Vitals/
        Vitals.jsx              # HRV, resting HR, sleep trends
        Vitals.module.css
      Data/
        Data.jsx                # Raw data explorer
        Data.module.css
      Profile/
        Profile.jsx             # Push notification toggle
        Profile.module.css
  desktop/
    layout/
      DesktopLayout.jsx         # Wraps pages with left Sidebar
      DesktopLayout.module.css
      Sidebar/
        Sidebar.jsx             # Left nav with page links
        Sidebar.module.css
    pages/
      Dashboard/
        Dashboard.jsx           # ATL/CTL chart, fitness metrics, sport load
        Dashboard.module.css
  App.jsx                       # React Router: mobile routes + desktop routes
  main.jsx                      # Vite entry point

tests/
  shared/
    hooks/
      useFetch.test.js
    components/
      Card.test.jsx
      BottomNav.test.jsx
  mobile/
    Home.test.jsx
    Checkin.test.jsx
    Profile.test.jsx
  desktop/
    Dashboard.test.jsx
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `src/main.jsx`
- Create: `src/App.jsx` (stub)
- Create: `vite.config.js`
- Create: `index.html` (Vite entry, root-level)
- Modify: `vercel.json` (output dir, SPA rewrites, preserve cron + headers)
- Create: `vitest.config.js`
- Modify: `package.json` (add dev dependencies, scripts)

**Interfaces:**
- Produces: `npm run dev` starts Vite dev server; `npm run build` outputs to `dist/`; `npm run test` runs Vitest; `npm run preview` serves `dist/`

- [ ] **Step 1: Install dependencies**

```bash
npm install react react-dom react-router-dom
npm install -D vite @vitejs/plugin-react vite-plugin-pwa vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      filename: 'sw.js',
      manifest: false, // keep existing manifest.webmanifest in public/
    }),
  ],
  build: { outDir: 'dist' },
})
```

- [ ] **Step 3: Create root-level `index.html`**

Standard Vite entry: `<div id="root">` + `<script type="module" src="/src/main.jsx">`. Copy `<meta>` tags and manifest link from `static/index.html`.

- [ ] **Step 4: Create `src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
```

- [ ] **Step 5: Create stub `src/App.jsx`**

```jsx
export default function App() { return <div>Coach</div> }
```

- [ ] **Step 6: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], test: { environment: 'jsdom', setupFiles: ['./tests/setup.js'] } })
```

Create `tests/setup.js`: `import '@testing-library/jest-dom'`

- [ ] **Step 7: Update `package.json` scripts**

Add: `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"`, `"test": "vitest run"`

- [ ] **Step 8: Update `vercel.json`**

Change `outputDirectory` to `dist`. Replace the single `/dashboard` rewrite with a catch-all: `{ "source": "/((?!api/).*)", "destination": "/index.html" }`. Keep `functions`, `crons`, and `headers` entries unchanged.

- [ ] **Step 9: Move static assets to `public/`**

Copy `static/icons/`, `static/manifest.webmanifest`, `static/css/` to `public/` so Vite serves them at `/`.

- [ ] **Step 10: Verify scaffold builds**

```bash
npm run build
```
Expected: `dist/` created, no errors.

- [ ] **Step 11: Commit**

```bash
git add vite.config.js index.html src/main.jsx src/App.jsx vitest.config.js tests/setup.js package.json package-lock.json vercel.json public/
git commit -m "feat: vite + react scaffold with pwa plugin and vercel spa routing"
```

---

### Task 2: Design Tokens and Chart Utilities

**Files:**
- Create: `src/shared/tokens/colors.module.css`
- Create: `src/shared/tokens/typography.module.css`
- Create: `src/shared/charts/wellness-labels.js`
- Create: `src/shared/charts/charts.js`

**Interfaces:**
- Produces: CSS custom properties `--color-blue`, `--color-bg`, `--color-text`, `--color-secondary`, `--color-green`, `--color-red`, `--color-yellow`, `--color-border`, `--color-card`
- Produces: `export { WELLNESS, WELLNESS_COLORS }` from `wellness-labels.js`
- Produces: `export { buildTimeline, drawHRVChart, drawSleepChart, drawFitnessChart, ... }` from `charts.js` — exact exports to match what dashboard and vitals pages use

- [ ] **Step 1: Create `src/shared/tokens/colors.module.css`**

Define `:root` custom properties from Global Constraints values. No classes — just `:root { --color-blue: #007aff; ... }`.

- [ ] **Step 2: Create `src/shared/tokens/typography.module.css`**

Font stack, size scale, weight scale — extracted from existing inline CSS patterns.

- [ ] **Step 3: Migrate `static/js/wellness-labels.js` to ES module**

Copy `static/js/wellness-labels.js`, replace `(function(root){...root.WELLNESS=...})(...)` with `export const WELLNESS = ...; export const WELLNESS_COLORS = ...`.

- [ ] **Step 4: Migrate `static/js/charts.js` to ES module**

Copy `static/js/charts.js`, replace IIFE wrapper with ES module. Replace `const { WELLNESS, WELLNESS_COLORS } = typeof module !== 'undefined' ? require(...) : root` with `import { WELLNESS, WELLNESS_COLORS } from './wellness-labels.js'`. Export all public functions.

- [ ] **Step 5: Verify existing tests still pass**

```bash
npm run test
```
Expected: PASS (the Node tests in `tests/` import from `static/js/` — they are unaffected; this step confirms nothing broke)

- [ ] **Step 6: Commit**

```bash
git add src/shared/
git commit -m "feat: design tokens and chart utilities as es modules"
```

---

### Task 3: Shared API Hooks

**Files:**
- Create: `src/shared/hooks/useFetch.js`
- Create: `src/shared/hooks/useCoach.js`
- Create: `src/shared/hooks/useDashboard.js`
- Create: `src/shared/hooks/useSportLoad.js`
- Create: `src/shared/hooks/useVitals.js`
- Create: `src/shared/hooks/useWellness.js`
- Create: `src/shared/hooks/usePush.js`
- Test: `tests/shared/hooks/useFetch.test.js`

**Interfaces:**
- Produces: `useFetch(url: string) → { data: any, loading: boolean, error: string|null }`
- Produces: `useCoach() → { data, loading, error }` (fetches `/api/get-coach`)
- Produces: `useDashboard() → { data, loading, error }` (fetches `/api/get-dashboard`)
- Produces: `useSportLoad() → { data, loading, error }` (fetches `/api/get-sport-load`)
- Produces: `useVitals() → { data, loading, error }` (fetches `/api/get-vitals`)
- Produces: `useWellness() → { submit: (payload) => Promise, loading, error, success }`
- Produces: `usePush() → { enabled, toggle: () => void, sendTest: () => void, loading }`

- [ ] **Step 1: Write failing test for `useFetch`**

```js
// tests/shared/hooks/useFetch.test.js
import { renderHook, waitFor } from '@testing-library/react'
import { useFetch } from '../../../src/shared/hooks/useFetch'

it('fetches url and returns data', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ score: 72 }) })
  const { result } = renderHook(() => useFetch('/api/get-coach'))
  expect(result.current.loading).toBe(true)
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.data).toEqual({ score: 72 })
  expect(result.current.error).toBeNull()
})

it('sets error on fetch failure', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
  const { result } = renderHook(() => useFetch('/api/get-coach'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.error).toBeTruthy()
  expect(result.current.data).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/shared/hooks/useFetch.test.js
```
Expected: FAIL — `useFetch` not found

- [ ] **Step 3: Implement `useFetch` in `src/shared/hooks/useFetch.js`**

`useState` for `{ data, loading, error }`. `useEffect` on `url`: fetch, `response.ok` check, set state. Export named.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/shared/hooks/useFetch.test.js
```
Expected: PASS

- [ ] **Step 5: Implement endpoint hooks**

Each is a one-liner calling `useFetch` with the right URL:
- `useCoach` → `useFetch('/api/get-coach')`
- `useDashboard` → `useFetch('/api/get-dashboard')`
- `useSportLoad` → `useFetch('/api/get-sport-load')`
- `useVitals` → `useFetch('/api/get-vitals')`

- [ ] **Step 6: Implement `useWellness`**

`useState` for `{ loading, error, success }`. Returns `submit(payload)`: POST to `/api/update-wellness` with `Content-Type: application/json`. Sets `success` on 200, `error` on failure.

- [ ] **Step 7: Implement `usePush`**

On mount (once): check `Notification.permission` and existing `serviceWorker` registration for active push subscription → set `enabled`. `toggle()`: if disabled, call `pushManager.subscribe` then POST `/api/push-subscribe`; if enabled, unsubscribe. `sendTest()`: POST `/api/push-test`. Wrap in try/catch; set `loading` during async ops.

- [ ] **Step 8: Commit**

```bash
git add src/shared/hooks/ tests/shared/hooks/
git commit -m "feat: shared api hooks (useFetch, useCoach, useDashboard, useVitals, useWellness, usePush)"
```

---

### Task 4: Shared UI Components

**Files:**
- Create: `src/shared/components/Card/Card.jsx` + `Card.module.css`
- Create: `src/shared/components/Ring/Ring.jsx` + `Ring.module.css`
- Test: `tests/shared/components/Card.test.jsx`

**Interfaces:**
- Produces: `<Card title?: string>children</Card>` — white, `border-radius: 16px`, `margin: 0 12px 12px`, `padding: 16px`
- Produces: `<Ring value: number color: string label: string size?: number />` — SVG ring, stroke based on `value` (0–100)

- [ ] **Step 1: Write failing test for Card**

```jsx
// tests/shared/components/Card.test.jsx
import { render, screen } from '@testing-library/react'
import { Card } from '../../../src/shared/components/Card/Card'

it('renders children', () => {
  render(<Card>hello</Card>)
  expect(screen.getByText('hello')).toBeInTheDocument()
})

it('renders title when provided', () => {
  render(<Card title="HRV">content</Card>)
  expect(screen.getByText('HRV')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test -- tests/shared/components/Card.test.jsx
```

- [ ] **Step 3: Implement `Card`**

`div.card` with `styles.card` from CSS Module. When `title` prop present, render `<p className={styles.title}>{title}</p>` above children. CSS: white background, `border-radius: 16px`, `padding: 16px`, `margin: 0 12px 12px`, `box-shadow: 0 1px 3px rgba(0,0,0,0.06)`.

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test -- tests/shared/components/Card.test.jsx
```

- [ ] **Step 5: Implement `Ring`**

SVG with two `<circle>` elements: track (gray, full stroke) and fill (colored, `strokeDasharray` from `value`). Props: `value` (0–100), `color` (hex), `label` (string below ring), `size` (default 60). No test required — visual only.

- [ ] **Step 6: Commit**

```bash
git add src/shared/components/ tests/shared/components/
git commit -m "feat: shared Card and Ring components"
```

---

### Task 5: Navigation Components and Mobile Layout

**Files:**
- Create: `src/shared/components/TopBar/TopBar.jsx` + `TopBar.module.css`
- Create: `src/shared/components/BottomNav/BottomNav.jsx` + `BottomNav.module.css`
- Create: `src/mobile/layout/MobileLayout.jsx` + `MobileLayout.module.css`
- Modify: `src/App.jsx` (wire mobile routes under MobileLayout)
- Test: `tests/shared/components/BottomNav.test.jsx`

**Interfaces:**
- Consumes: `Card`, design tokens from Task 2–4
- Produces: `<TopBar title: string />` — sticky, 52px, title + today's date + profile link
- Produces: `<BottomNav />` — fixed bottom, 5 tabs: Home `/`, Check-in `/checkin`, Vitals `/vitals`, Data `/data`, Profile `/profile`; active tab matches current route
- Produces: `<MobileLayout title: string>` — wraps page content between TopBar and BottomNav; `max-width: 430px`, bottom padding for nav bar

- [ ] **Step 1: Write failing test for BottomNav active state**

```jsx
// tests/shared/components/BottomNav.test.jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from '../../../src/shared/components/BottomNav/BottomNav'

it('marks home link active on / route', () => {
  render(<MemoryRouter initialEntries={['/']}><BottomNav /></MemoryRouter>)
  const homeLink = screen.getByRole('link', { name: /home/i })
  expect(homeLink).toHaveClass('active')
})

it('marks vitals link active on /vitals route', () => {
  render(<MemoryRouter initialEntries={['/vitals']}><BottomNav /></MemoryRouter>)
  const link = screen.getByRole('link', { name: /vitals/i })
  expect(link).toHaveClass('active')
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test -- tests/shared/components/BottomNav.test.jsx
```

- [ ] **Step 3: Implement `BottomNav`**

Use React Router's `NavLink` with `className={({ isActive }) => isActive ? styles.active : undefined}`. Five links with SVG icons matching existing HTML (use `end` prop on Home link). CSS: `position: fixed`, bottom, `height: calc(80px + env(safe-area-inset-bottom))`, `max-width: 430px`, centered.

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test -- tests/shared/components/BottomNav.test.jsx
```

- [ ] **Step 5: Implement `TopBar`**

`title` prop + today's date formatted as `"Day\nDD Mon"` (two lines). Profile icon link to `/profile` (hidden on `/profile` route — use `useLocation`). Sticky, `z-index: 10`.

- [ ] **Step 6: Implement `MobileLayout`**

Renders `<TopBar title={title} />`, `<main className={styles.content}>{children}</main>`, `<BottomNav />`. CSS: `max-width: 430px`, centered, `padding-bottom: calc(88px + env(safe-area-inset-bottom))`.

- [ ] **Step 7: Wire routes in `src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MobileLayout from './mobile/layout/MobileLayout'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MobileLayout title="Coach" />}>
          <Route index element={<div>Home stub</div>} />
          <Route path="checkin" element={<div>Checkin stub</div>} />
          <Route path="vitals" element={<div>Vitals stub</div>} />
          <Route path="data" element={<div>Data stub</div>} />
          <Route path="profile" element={<div>Profile stub</div>} />
        </Route>
        <Route path="dashboard" element={<div>Dashboard stub</div>} />
      </Routes>
    </BrowserRouter>
  )
}
```

MobileLayout renders child routes via `<Outlet />`.

- [ ] **Step 8: Verify dev server shows nav**

```bash
npm run dev
```
Open `http://localhost:5173` — bottom nav visible, links navigate between stubs.

- [ ] **Step 9: Commit**

```bash
git add src/shared/components/TopBar/ src/shared/components/BottomNav/ src/mobile/layout/ src/App.jsx
git commit -m "feat: TopBar, BottomNav, MobileLayout and mobile router skeleton"
```

---

### Task 6: Home Page

**Files:**
- Create: `src/mobile/pages/Home/Home.jsx` + `Home.module.css`
- Modify: `src/App.jsx` (replace Home stub)
- Test: `tests/mobile/Home.test.jsx`

**Interfaces:**
- Consumes: `useCoach()`, `Card`, `Ring`
- Produces: Home page rendering readiness score, three rings (Move, Exercise, Stand), physio metric cards (HRV, resting HR, sleep, weight)

- [ ] **Step 1: Write failing test**

```jsx
// tests/mobile/Home.test.jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from '../../../src/mobile/pages/Home/Home'

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ readiness: 72, hrv: 55, restingHR: 48 })
  })
})

it('renders without crashing', () => {
  render(<MemoryRouter><Home /></MemoryRouter>)
  expect(document.body).toBeTruthy()
})

it('shows loading state initially', () => {
  render(<MemoryRouter><Home /></MemoryRouter>)
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test -- tests/mobile/Home.test.jsx
```

- [ ] **Step 3: Implement `Home.jsx`**

Call `useCoach()`. While `loading`, render `<p>Loading…</p>`. On `error`, render error message. On data: render readiness score card, three `Ring` components, physio metric cards. Mirror the structure from `static/index.html` using `Card` and CSS Modules for spacing. SVG ring chart for readiness from `src/shared/charts/charts.js`.

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test -- tests/mobile/Home.test.jsx
```

- [ ] **Step 5: Replace stub in `App.jsx`**

Import `Home` and replace `<div>Home stub</div>`.

- [ ] **Step 6: Commit**

```bash
git add src/mobile/pages/Home/ src/App.jsx tests/mobile/Home.test.jsx
git commit -m "feat: Home page (readiness, rings, physio metrics)"
```

---

### Task 7: Check-in Page

**Files:**
- Create: `src/mobile/pages/Checkin/Checkin.jsx` + `Checkin.module.css`
- Modify: `src/App.jsx`
- Test: `tests/mobile/Checkin.test.jsx`

**Interfaces:**
- Consumes: `useWellness()`, `Card`
- Produces: Wellness logging form — subjective fields (mood, fatigue, soreness, sleep quality, motivation) + weight input + submit button; shows success/error state after submit

- [ ] **Step 1: Write failing test**

```jsx
it('renders the submit button', () => {
  render(<MemoryRouter><Checkin /></MemoryRouter>)
  expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
})

it('disables submit while loading', async () => {
  global.fetch = vi.fn(() => new Promise(() => {})) // never resolves
  render(<MemoryRouter><Checkin /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement `Checkin.jsx`**

Local `useState` for each wellness field. Calls `useWellness().submit(payload)` on form submit. Button disabled while `loading`. Shows `success` or `error` message below form. Mirror field layout from `static/checkin.html` (button groups per field, weight number input).

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Replace stub in `App.jsx`**

- [ ] **Step 6: Commit**

```bash
git add src/mobile/pages/Checkin/ src/App.jsx tests/mobile/Checkin.test.jsx
git commit -m "feat: Check-in page (wellness logging form)"
```

---

### Task 8: Vitals and Data Pages

**Files:**
- Create: `src/mobile/pages/Vitals/Vitals.jsx` + `Vitals.module.css`
- Create: `src/mobile/pages/Data/Data.jsx` + `Data.module.css`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useVitals()`, `Card`, chart functions from `src/shared/charts/charts.js`
- Produces: Vitals page with HRV, resting HR, sleep trend charts; Data page with raw data table/explorer

- [ ] **Step 1: Implement `Vitals.jsx`**

Call `useVitals()`. Render loading/error states. Render metric cards with trend charts using functions from `charts.js` inside SVG containers. Mirror `static/vitals.html` layout.

- [ ] **Step 2: Implement `Data.jsx`**

Mirror `static/data.html` — segmented control for data type, table of recent values. No separate test required beyond render-without-crash (covered by App routing test in Task 5).

- [ ] **Step 3: Replace stubs in `App.jsx`**

- [ ] **Step 4: Commit**

```bash
git add src/mobile/pages/Vitals/ src/mobile/pages/Data/ src/App.jsx
git commit -m "feat: Vitals and Data pages"
```

---

### Task 9: Profile Page and PWA

**Files:**
- Create: `src/mobile/pages/Profile/Profile.jsx` + `Profile.module.css`
- Modify: `src/App.jsx`
- Test: `tests/mobile/Profile.test.jsx`

**Interfaces:**
- Consumes: `usePush()`
- Produces: Profile page with push notification toggle and "Send test" button; PWA install prompt handled by `vite-plugin-pwa`

- [ ] **Step 1: Write failing test (addresses Review Focus item)**

```jsx
// tests/mobile/Profile.test.jsx
it('renders push toggle without crashing', () => {
  Object.defineProperty(global, 'Notification', { value: { permission: 'default' }, configurable: true })
  render(<MemoryRouter><Profile /></MemoryRouter>)
  expect(screen.getByRole('switch') ?? screen.getByRole('button')).toBeInTheDocument()
})

it('calls subscribe at most once on mount', async () => {
  const mockCheck = vi.fn().mockResolvedValue(null)
  // mock navigator.serviceWorker.ready.pushManager.getSubscription
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve({ pushManager: { getSubscription: mockCheck } }) },
    configurable: true
  })
  render(<MemoryRouter><Profile /></MemoryRouter>)
  await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1))
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement `Profile.jsx`**

Call `usePush()`. Render toggle (iOS-style checkbox or switch) bound to `enabled`; `onChange` calls `toggle()`. "Send test notification" button calls `sendTest()`; disabled while `loading`. Show current permission status. Mirror `static/profile.html`.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Verify PWA manifest in build**

```bash
npm run build && ls dist/sw.js dist/manifest.webmanifest
```
Expected: both files present

- [ ] **Step 6: Replace stub in `App.jsx`**

- [ ] **Step 7: Commit**

```bash
git add src/mobile/pages/Profile/ src/App.jsx tests/mobile/Profile.test.jsx
git commit -m "feat: Profile page with push notifications and PWA"
```

---

### Task 10: Desktop Layout and Sidebar

**Files:**
- Create: `src/desktop/layout/DesktopLayout.jsx` + `DesktopLayout.module.css`
- Create: `src/desktop/layout/Sidebar/Sidebar.jsx` + `Sidebar.module.css`
- Modify: `src/App.jsx` (wire `/dashboard` under DesktopLayout)

**Interfaces:**
- Produces: `<DesktopLayout title: string>` — full-width layout with left sidebar (220px) + main content area; `<Outlet />` renders child routes
- Produces: `<Sidebar />` — vertical nav with app name, links: Dashboard `/dashboard`; active link uses `NavLink`

- [ ] **Step 1: Implement `Sidebar.jsx`**

`NavLink` to `/dashboard` with active class. App name/logo at top. CSS: `width: 220px`, `height: 100vh`, sticky, white background, `border-right: 1px solid var(--color-border)`, link items with hover state.

- [ ] **Step 2: Implement `DesktopLayout.jsx`**

Flex row: `<Sidebar />` + `<main>` with `<Outlet />`. Full-width, no max-width constraint. Top bar optional (can be omitted on desktop — builder's call).

- [ ] **Step 3: Wire in `App.jsx`**

```jsx
<Route path="dashboard" element={<DesktopLayout title="Dashboard" />}>
  <Route index element={<div>Dashboard stub</div>} />
</Route>
```

- [ ] **Step 4: Verify layout renders**

```bash
npm run dev
```
Navigate to `http://localhost:5173/dashboard` — sidebar visible on left, stub content on right.

- [ ] **Step 5: Commit**

```bash
git add src/desktop/layout/ src/App.jsx
git commit -m "feat: desktop layout with left sidebar"
```

---

### Task 11: Dashboard Page

**Files:**
- Create: `src/desktop/pages/Dashboard/Dashboard.jsx` + `Dashboard.module.css`
- Modify: `src/App.jsx`
- Test: `tests/desktop/Dashboard.test.jsx`

**Interfaces:**
- Consumes: `useDashboard()`, `useSportLoad()`, `Card`, chart functions from `charts.js`
- Produces: Dashboard with ATL/CTL fitness chart, training load numbers (ATL, CTL, TSB), sport load breakdown by sport type

- [ ] **Step 1: Write failing test**

```jsx
// tests/desktop/Dashboard.test.jsx
it('renders without crashing', () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  render(<MemoryRouter><Dashboard /></MemoryRouter>)
  expect(document.body).toBeTruthy()
})

it('fetches both dashboard and sport-load endpoints', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  render(<MemoryRouter><Dashboard /></MemoryRouter>)
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/get-dashboard'))
  expect(global.fetch).toHaveBeenCalledWith('/api/get-sport-load')
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement `Dashboard.jsx`**

Call `useDashboard()` and `useSportLoad()` in parallel (both hooks fire immediately on mount). Show loading until both resolve. Render: fitness numbers row (ATL, CTL, TSB), ATL/CTL line chart using `charts.js` `drawFitnessChart`, sport load breakdown cards. Mirror `static/dashboard.html` layout adapted for full-width desktop.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Replace stub in `App.jsx`**

- [ ] **Step 6: Run full test suite**

```bash
npm run test
```
Expected: all tests PASS

- [ ] **Step 7: Verify build**

```bash
npm run build
```
Expected: `dist/` builds clean, no warnings about missing imports.

- [ ] **Step 8: Commit**

```bash
git add src/desktop/pages/Dashboard/ src/App.jsx tests/desktop/Dashboard.test.jsx
git commit -m "feat: Dashboard page (ATL/CTL, fitness metrics, sport load)"
```

---

## Post-migration checklist

- [ ] `npm run build` succeeds with no errors
- [ ] `npm run test` — all tests pass
- [ ] Deploy preview on Vercel — mobile pages load on phone, `/dashboard` loads on browser
- [ ] PWA install prompt appears on mobile
- [ ] Push notification toggle works on Profile page
- [ ] Cron job (`/api/cron-morning`) unaffected — test manually or check Vercel cron logs
- [ ] All six original HTML pages in `static/` can be removed once deploy is verified
