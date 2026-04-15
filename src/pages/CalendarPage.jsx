import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { TYPE_COLORS, TYPE_LABELS, TYPE_BG } from '../utils/milestoneUtils'

const MONTHS_LABEL = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function CalendarPage() {
  const [projects, setProjects] = useState([])
  const [today] = useState(new Date())
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects'), snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)) }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)) }
  function goToday() { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)) }

  // Get projects active on a given day
  function getProjectsForDay(day) {
    const date = new Date(year, month, day)
    return projects.filter(p => {
      if (!p.startDate || !p.endDate) return false
      const s = new Date(p.startDate)
      const e = new Date(p.endDate)
      return date >= s && date <= e
    })
  }

  const isToday = (day) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h2 className="text-xl font-bold text-gray-800">日曆視圖</h2>
          <p className="text-sm text-gray-400">{year} 年 {MONTHS_LABEL[month]}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
            今天
          </button>
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">‹</button>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">›</button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto p-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />
            const dayProjects = getProjectsForDay(day)
            return (
              <div key={day}
                className={`min-h-24 rounded-lg p-1.5 border ${isToday(day) ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                <p className={`text-sm font-medium mb-1 ${isToday(day) ? 'text-blue-600' : 'text-gray-700'}`}>
                  {day}
                </p>
                <div className="space-y-0.5">
                  {dayProjects.slice(0, 3).map(p => (
                    <div key={p.id}
                      className="text-xs px-1.5 py-0.5 rounded truncate text-white font-medium"
                      style={{ backgroundColor: TYPE_COLORS[p.type] || '#6B7280' }}
                      title={`${p.name} (${TYPE_LABELS[p.type]})`}>
                      {p.name}
                    </div>
                  ))}
                  {dayProjects.length > 3 && (
                    <p className="text-xs text-gray-400 pl-1">+{dayProjects.length - 3} 更多</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 px-2">
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: TYPE_COLORS[type] }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
