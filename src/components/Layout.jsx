import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: '甘特圖', icon: '📊', end: true },
  { to: '/calendar', label: '日曆', icon: '📅' },
  { to: '/projects', label: '專案管理', icon: '📋' },
  { to: '/leave', label: '休假預排', icon: '🏖️' },
  { to: '/sponsor', label: '體總贊助', icon: '🏆' },
  { to: '/people', label: '人員管理', icon: '👥' },
  { to: '/settings', label: '里程碑設定', icon: '⚙️' },
  { to: '/import', label: '匯入 Excel', icon: '📥' },
]

export default function Layout() {
  const { user, isAdmin, logout } = useAuth()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-800">Team Scheduler</h1>
          <p className="text-xs text-gray-400 mt-0.5">排程管理系統</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2 font-medium">圖例</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-xs text-gray-600">秀展</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-orange-500" />
              <span className="text-xs text-gray-600">活動</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span className="text-xs text-gray-600">報獎</span>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{user?.displayName}</p>
              {isAdmin && <p className="text-xs text-blue-500">管理者</p>}
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full text-xs text-gray-500 hover:text-red-500 text-left transition-colors"
          >
            登出
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
