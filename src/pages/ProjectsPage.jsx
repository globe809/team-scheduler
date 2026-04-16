import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { TYPE_LABELS, TYPE_COLORS, TYPE_BG, DEFAULT_RULES, getWorkStart } from '../utils/milestoneUtils'

const EVENT_SUBTYPES = ['尾牙', '春酒', '媒體春酒', 'HBL', '灣聲音樂會']
const AWARD_SUBTYPES = ['25大國際品牌', '台灣精品獎', 'BC Award', '體育推手獎', 'EE Awards']

const emptyForm = {
  name: '', type: 'tradeshow', subtype: '',
  startDate: '', endDate: '',
  location: '', showType: '', office: '', year: new Date().getFullYear(),
  assignments: [],
}

export default function ProjectsPage() {
  const { isAdmin } = useAuth()
  const [projects, setProjects] = useState([])
  const [people, setPeople] = useState([])
  const [rules, setRules] = useState(DEFAULT_RULES)
  const [showModal, setShowModal] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [filterType, setFilterType] = useState('all')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [showCompleted, setShowCompleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'projects'), snap =>
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const u2 = onSnapshot(collection(db, 'people'), snap =>
      setPeople(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const loadRules = async () => {
      const rd = await getDoc(doc(db, 'settings', 'milestoneRules'))
      if (rd.exists()) setRules({ ...DEFAULT_RULES, ...rd.data() })
    }
    loadRules()
    return () => { u1(); u2() }
  }, [])

  function openCreate() {
    setEditProject(null)
    setForm({ ...emptyForm, year: filterYear })
    setShowModal(true)
  }

  function openEdit(p) {
    setEditProject(p)
    setForm({
      name: p.name || '', type: p.type || 'tradeshow', subtype: p.subtype || '',
      startDate: p.startDate || '', endDate: p.endDate || '',
      location: p.location || '', showType: p.showType || '',
      office: p.office || '', year: p.year || new Date().getFullYear(),
      assignments: p.assignments || [],
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name || !form.startDate || !form.endDate) return
    setSaving(true)
    const data = {
      name: form.name, type: form.type, subtype: form.subtype,
      startDate: form.startDate, endDate: form.endDate,
      location: form.location, showType: form.showType,
      office: form.office, year: parseInt(form.year),
      assignments: form.assignments,
      updatedAt: new Date().toISOString(),
    }
    try {
      if (editProject) {
        await updateDoc(doc(db, 'projects', editProject.id), data)
      } else {
        data.createdAt = new Date().toISOString()
        await addDoc(collection(db, 'projects'), data)
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await deleteDoc(doc(db, 'projects', id))
    setDeleteConfirm(null)
  }

  function toggleAssignment(personId, role) {
    const existing = form.assignments.findIndex(a => a.personId === personId)
    if (existing >= 0) {
      setForm(f => ({ ...f, assignments: f.assignments.filter((_, i) => i !== existing) }))
    } else {
      setForm(f => ({ ...f, assignments: [...f.assignments, { personId, role }] }))
    }
  }

  const filtered = projects
    .filter(p => filterType === 'all' || p.type === filterType)
    .filter(p => !p.year || p.year === filterYear)
    .filter(p => showCompleted || p.status !== '已結束')
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))

  const years = [...new Set(projects.map(p => p.year).filter(Boolean))].sort()
  if (!years.includes(filterYear)) years.push(filterYear)
  years.sort()

  const designers = people.filter(p => p.role === 'designer')
  const planners = people.filter(p => p.role === 'planner')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h2 className="text-xl font-bold text-gray-800">專案管理</h2>
          <p className="text-sm text-gray-400">{filtered.length} 個專案</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year filter */}
          <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Type filter */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {[['all', '全部'], ['tradeshow', '秀展'], ['event', '活動'], ['award', '報獎']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterType(val)}
                className={`px-3 py-1.5 ${filterType === val ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCompleted(v => !v)}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${showCompleted ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
            {showCompleted ? '✓ 顯示已結束' : '已結束已隱藏'}
          </button>
          {isAdmin && (
            <button onClick={openCreate}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              + 新增專案
            </button>
          )}
        </div>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📋</div>
              <p>尚無專案，點擊「新增專案」開始</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(p => {
              const assigned = (p.assignments || []).map(a => {
                const person = people.find(pe => pe.id === a.personId)
                return person ? { ...person, role: a.role } : null
              }).filter(Boolean)
              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-1 h-12 rounded-full flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: TYPE_COLORS[p.type] }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-800 truncate">{p.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${TYPE_BG[p.type]}`}>
                            {TYPE_LABELS[p.type]}
                          </span>
                          {p.subtype && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">{p.subtype}</span>
                          )}
                          {p.datePending && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 flex-shrink-0">日期待定</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                          {p.startDate && <span>📅 {p.startDate} ~ {p.endDate}</span>}
                          {p.location && <span>📍 {p.location}</span>}
                          {p.showType && <span>🏷 {p.showType}</span>}
                        </div>
                        {assigned.length > 0 && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {assigned.map(a => (
                              <span key={a.id} className={`text-xs px-2 py-0.5 rounded-full ${a.role === 'designer' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                                {a.name} ({a.role === 'designer' ? '設計' : 'Planner'})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => openEdit(p)}
                          className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">
                          編輯
                        </button>
                        <button onClick={() => setDeleteConfirm(p.id)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
                          刪除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-800">{editProject ? '編輯專案' : '新增專案'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">類型</label>
                <div className="flex gap-2">
                  {[['tradeshow', '秀展'], ['event', '活動'], ['award', '報獎']].map(([val, label]) => (
                    <button key={val} onClick={() => setForm(f => ({ ...f, type: val, subtype: '' }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === val ? 'border-transparent text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      style={form.type === val ? { backgroundColor: TYPE_COLORS[val] } : {}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtype for event/award */}
              {form.type === 'event' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">活動類型</label>
                  <select value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">請選擇</option>
                    {EVENT_SUBTYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              {form.type === 'award' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">獎項</label>
                  <select value={form.subtype} onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">請選擇</option>
                    {AWARD_SUBTYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">專案名稱 *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例：Computex 2026"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日期 *</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">結束日期 *</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地點</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="例：Taipei, TW"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Show type (tradeshow only) */}
              {form.type === 'tradeshow' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">秀展類型</label>
                    <input value={form.showType} onChange={e => setForm(f => ({ ...f, showType: e.target.value }))}
                      placeholder="例：Automation"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">負責 Office</label>
                    <input value={form.office} onChange={e => setForm(f => ({ ...f, office: e.target.value }))}
                      placeholder="例：TW、US"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}

              {/* Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">年份</label>
                <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Assign people */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">指派人員</label>
                {designers.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1.5 font-medium">設計師</p>
                    <div className="flex flex-wrap gap-2">
                      {designers.map(p => {
                        const selected = form.assignments.some(a => a.personId === p.id)
                        return (
                          <button key={p.id} onClick={() => toggleAssignment(p.id, 'designer')}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${selected ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            {p.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {planners.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5 font-medium">Planner</p>
                    <div className="flex flex-wrap gap-2">
                      {planners.map(p => {
                        const selected = form.assignments.some(a => a.personId === p.id)
                        return (
                          <button key={p.id} onClick={() => toggleAssignment(p.id, 'planner')}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${selected ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            {p.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {people.length === 0 && (
                  <p className="text-sm text-gray-400">請先在「人員管理」新增成員</p>
                )}
              </div>

              {/* Work period preview */}
              {form.type === 'tradeshow' && form.startDate && form.assignments.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-700 mb-2">自動計算工作區間預覽</p>
                  {form.assignments.map(a => {
                    const person = people.find(pe => pe.id === a.personId)
                    if (!person) return null
                    const workStart = getWorkStart(form.startDate, a.role, rules)
                    return (
                      <p key={a.personId} className="text-xs text-blue-600">
                        {person.name} ({a.role === 'designer' ? '設計師' : 'Planner'})：
                        {workStart.toLocaleDateString('zh-TW')} ~ {form.endDate}
                      </p>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.startDate || !form.endDate}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-medium">
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">確認刪除</h3>
            <p className="text-sm text-gray-500 mb-6">刪除後無法復原，確定要刪除這個專案嗎？</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
