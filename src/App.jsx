import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import GanttPage from './pages/GanttPage'
import CalendarPage from './pages/CalendarPage'
import ProjectsPage from './pages/ProjectsPage'
import PeoplePage from './pages/PeoplePage'
import SettingsPage from './pages/SettingsPage'
import ImportPage from './pages/ImportPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<GanttPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="import" element={<ImportPage />} />
      </Route>
    </Routes>
  )
}
