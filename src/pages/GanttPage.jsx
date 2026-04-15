import { useEffect, useState, useRef } from 'react'
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { buildBarsForPerson, TYPE_COLORS, TYPE_LABELS, DEFAULT_RULES } from '../utils/milestoneUtils'

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 56
const LEFT_WIDTH = 160

export default function GanttPage() {
  const [people, setPeople] = useState([])
  const [projects, setProjects] = useState([])
  const [rules, setRules] = useState(DEFAULT_RULES)
  const [year, setYear] = useState(new Date().getFullYear())
  const [tooltip, setTooltip] = useState(null)
  const [filterRole, setFilterRole] = useState('all')
  const scrollRef = useRef(null)

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'people'), snap => {
      setPeople(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    const unsub2 = onSnapshot(collection(db, 'projects'), snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    const loadRules = async () => {
      const rDoc = await getDoc(doc(db, 'settings', 'milestoneRules'))
      if (rDoc.exists()) setRules({ ...DEFAULT_RULES, ...rDoc.data() })
    }
    loadRules()
    return () => { unsub1(); unsub2() }
  }, [])

  // Year bounds
  const viewStart = new Date(year, 0, 1)
  const viewEnd = new Date(year, 11, 31)
  const totalDays = Math.round((viewEnd - viewStart) / 86400000) + 1

  function dayOffset(date) {
    const d = new Date(date)
    return Math.round((d - viewStart) / 86400000)
  }

  function pct(days) {
    return (days / totalDays) * 100
  }

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) {
      const todayOffset = dayOffset(new Date())
      const containerWidth = scrollRef.current.clientWidth - LEFT_WIDTH
      const todayPx = (todayOffset / totalDays) * scrollRef.current.scrollWidth
      scrollRef.current.scrollLeft = Math.max(0, todayPx - containerWidth / 2)
    }
  }, [year])

  const filteredPeople = people.filter(p => filterRole === 'all' || p.role === filterRole)
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'designer' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-TW')
    })

  const todayOffset = dayOffset(new Date())
  const isCurrentYear = year === new Date().getFullYear()

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h2 className="text-xl font-bold text-gray-800">甘特圖總覽</h2>
          <p className="text-sm text-gray-400">{filteredPeople.length} 位成員</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Role filter */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {[['all', '全部'], ['designer', '設計師'], ['planner', 'Planner']].map(([val, label]) => (
              <button key={val}
                onClick={() => setFilterRole(val)}
                className={`px-3 py-1.5 ${filterRole === val ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >{label}</button>
            ))}
          </div>
          {/* Year selector */}
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">‹</button>
            <span className="font-semibold text-gray-800 w-12 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">›</button>
          </div>
        </div>
      </div>

      {/* Gantt body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {filteredPeople.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">👥</div>
              <p>尚未新增人員，請先到「人員管理」新增成員</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto gantt-scroll" ref={scrollRef}>
            <div style={{ minWidth: '1200px' }}>
              {/* Month header */}
              <div className="flex sticky top-0 bg-white z-10 border-b" style={{ height: HEADER_HEIGHT }}>
                <div className="flex-shrink-0 border-r bg-gray-50 flex items-center px-4" style={{ width: LEFT_WIDTH }}>
                  <span className="text-xs font-medium text-gray-500">成員</span>
                </div>
                <div className="flex-1 relative">
                  {MONTHS.map((m, i) => {
                    const monthStart = new Date(year, i, 1)
                    const monthEnd = new Date(year, i + 1, 0)
                    const left = pct(dayOffset(monthStart))
                    const width = pct(Math.round((monthEnd - monthStart) / 86400000) + 1)
                    return (
                      <div key={i} className="absolute top-0 border-r border-gray-200 flex flex-col justify-center items-center"
                        style={{ left: `${left}%`, width: `${width}%`, height: HEADER_HEIGHT }}>
                        <span className="text-xs font-medium text-gray-600">{m}</span>
                      </div>
                    )
                  })}
                  {/* Today line in header */}
                  {isCurrentYear && (
                    <div className="absolute top-0 bottom-0 w-px bg-red-400 z-20"
                      style={{ left: `${pct(todayOffset)}%` }} />
                  )}
                </div>
              </div>

              {/* People rows */}
              {filteredPeople.map((person, pi) => {
                const bars = buildBarsForPerson(person.id, projects, rules).filter(b => {
                  const start = new Date(b.workStart)
                  const end = new Date(b.workEnd)
                  return start.getFullYear() === year || end.getFullYear() === year ||
                    (start < viewStart && end > viewEnd)
                })

                return (
                  <div key={person.id} className={`flex border-b ${pi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    style={{ height: ROW_HEIGHT }}>
                    {/* Person name */}
                    <div className="flex-shrink-0 border-r flex items-center px-4 gap-2" style={{ width: LEFT_WIDTH }}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${person.role === 'designer' ? 'bg-purple-400' : 'bg-teal-400'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{person.name}</p>
                        <p className="text-xs text-gray-400">{person.role === 'designer' ? '設計師' : 'Planner'}</p>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="flex-1 relative">
                      {/* Month grid lines */}
                      {MONTHS.map((_, i) => {
                        const monthStart = new Date(year, i, 1)
                        const left = pct(dayOffset(monthStart))
                        return <div key={i} className="absolute top-0 bottom-0 w-px bg-gray-100" style={{ left: `${left}%` }} />
                      })}

                      {/* Today line */}
                      {isCurrentYear && (
                        <div className="absolute top-0 bottom-0 w-px bg-red-300 z-10"
                          style={{ left: `${pct(todayOffset)}%` }} />
                      )}

                      {/* Bars */}
                      {bars.map((bar, bi) => {
                        const clampedStart = new Date(Math.max(new Date(bar.workStart), viewStart))
                        const clampedEnd = new Date(Math.min(new Date(bar.workEnd), viewEnd))
                        const leftPct = pct(dayOffset(clampedStart))
                        const widthPct = pct(Math.round((clampedEnd - clampedStart) / 86400000) + 1)
                        if (widthPct <= 0) return null

                        return (
                          <div key={bi}
                            className="absolute top-1/2 -translate-y-1/2 rounded cursor-pointer transition-opacity hover:opacity-80 flex items-center overflow-hidden"
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              height: 24,
                              backgroundColor: bar.color,
                              opacity: 0.85,
                              zIndex: 5,
                            }}
                            onMouseEnter={(e) => setTooltip({ bar, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            <span className="text-white text-xs font-medium px-2 truncate select-none">
                              {bar.projectName}
                            </span>
                            {/* Milestone diamonds */}
                            {bar.milestones.map((ms) => {
                              const msOffset = dayOffset(ms.date)
                              const barStartOffset = dayOffset(clampedStart)
                              const barTotalDays = Math.round((clampedEnd - clampedStart) / 86400000) + 1
                              if (msOffset < barStartOffset || msOffset > barStartOffset + barTotalDays) return null
                              const msPct = ((msOffset - barStartOffset) / barTotalDays) * 100
                              return (
                                <div key={ms.key}
                                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rotate-45 border border-gray-300"
                                  style={{ left: `${msPct}%`, zIndex: 6 }}
                                  title={ms.label}
                                />
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8, maxWidth: 220 }}>
          <p className="font-semibold mb-1">{tooltip.bar.projectName}</p>
          <p className="text-gray-300">{TYPE_LABELS[tooltip.bar.type]}</p>
          <p className="text-gray-300">{tooltip.bar.role === 'designer' ? '設計師' : 'Planner'}</p>
          <p className="text-gray-300 mt-1">
            {new Date(tooltip.bar.workStart).toLocaleDateString('zh-TW')} – {new Date(tooltip.bar.workEnd).toLocaleDateString('zh-TW')}
          </p>
          {tooltip.bar.milestones.length > 0 && (
            <div className="mt-2 border-t border-gray-700 pt-2">
              <p className="text-gray-400 mb-1">里程碑</p>
              {tooltip.bar.milestones.map(ms => (
                <p key={ms.key} className="text-gray-300">◆ {ms.label}: {new Date(ms.date).toLocaleDateString('zh-TW')}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
