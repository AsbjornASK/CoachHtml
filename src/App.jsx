import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from './mobile/pages/HomePage'
import { CheckinPage } from './mobile/pages/CheckinPage'
import { VitalsPage } from './mobile/pages/VitalsPage'
import { DashboardPage } from './mobile/pages/DashboardPage'
import { DataPage } from './mobile/pages/DataPage'
import { ProfilePage } from './mobile/pages/ProfilePage'
import './shared/tokens/tokens.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/checkin" element={<CheckinPage />} />
        <Route path="/vitals" element={<VitalsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </BrowserRouter>
  )
}
