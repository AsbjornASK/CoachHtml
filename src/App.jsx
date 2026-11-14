import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from './mobile/pages/HomePage'
import { CheckinPage } from './mobile/pages/CheckinPage'
import { VitalsPage } from './mobile/pages/VitalsPage'
import { DashboardPage } from './mobile/pages/DashboardPage'
import { DataPage } from './mobile/pages/DataPage'
import { ProfilePage } from './mobile/pages/ProfilePage'
import { DesktopLayout } from './desktop/components/DesktopLayout'
import './shared/tokens/tokens.css'
import './App.css'

// Pages are the same components; the outer layout adapts to viewport width.
// ≤ 768px → MobileLayout (each page renders its own); > 768px → DesktopLayout wraps all pages.
function DesktopRoutes() {
  return (
    <DesktopLayout>
      <Routes>
        <Route path="/" element={<HomePage desktop />} />
        <Route path="/checkin" element={<CheckinPage desktop />} />
        <Route path="/vitals" element={<VitalsPage desktop />} />
        <Route path="/dashboard" element={<DashboardPage desktop />} />
        <Route path="/data" element={<DataPage desktop />} />
        <Route path="/profile" element={<ProfilePage desktop />} />
      </Routes>
    </DesktopLayout>
  )
}

function MobileRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/checkin" element={<CheckinPage />} />
      <Route path="/vitals" element={<VitalsPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/data" element={<DataPage />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="mobile-only"><MobileRoutes /></div>
      <div className="desktop-only"><DesktopRoutes /></div>
    </BrowserRouter>
  )
}
