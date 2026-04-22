import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import GanttPage from './pages/GanttPage'
import CalendarPage from './pages/CalendarPage'
import ProjectsPage from './pages/ProjectsPage'
import PeoplePage from './pages/PeoplePage'
import SettingsPage from './pages/SettingsPage'
import ImportPage from './pages/ImportPage'
import LeavePage from './pages/LeavePage'
import SponsorPage from './pages/SponsorPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">載入中…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">載入中…</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<GanttPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="sponsor" element={<SponsorPage />} />
      </Route>
    </Routes>
  )
}
