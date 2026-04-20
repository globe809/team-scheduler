import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { TYPE_LABELS, TYPE_COLORS, TYPE_BG, DEFAULT_RULES, getWorkStart, getLoadingLevel, LOADING_COLORS } from '../utils/milestoneUtils'

const EVENT_SUBTYPES = ['尾牙', '春酒', '媒體春酒', 'HBL', '灣聲音樂會']
const AWARD_SUBTYPES = ['25大國際品牌', '台灣精品獎', 'BC Award', '體育推手獎', 'EE Awards']

const KV_CATEGORIES = ['台灣節日', '親情愛情節日', '季節促銷', '購物節', '年末節慶促銷']
const KV_REGIONS = ['WWW', 'CN/SD2', 'SD1', 'SD2']

const emptyForm = {
  name: '', type: 'tradeshow', subtype: '',
  startDate: '', endDate: '',
  location: '', showType: '', office: '', year: new Date().getFullYear(),
  assignments: [],
  // tradeshow specific
  boothSize: '',
  // seasonal_kv specific
  kvEventDate: '', kvCategory: '', kvRegion: 'WWW', kvNote: '',
}

// Auto-calc kickoff/release from event date
function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
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
      boothSize: p.boothSize || '',
      kvEventDate: p.endDate || '', kvCategory: p.kvCategory || '', kvRegion: p.kvRegion || 'WWW', kvNote: p.note || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name) return
    if (form.type === 'seasonal_kv' && !form.kvEventDate) return
    if (form.type !== 'seasonal_kv' && (!form.startDate || !form.endDate)) return
    setSaving(true)

    let data = {
      name: form.name, type: form.type, subtype: form.subtype,
      location: form.location,
      year: parseInt(form.year),
      assignments: form.assignments,
      updatedAt: new Date().toISOString(),
    }

    if (form.type === 'tradeshow') {
      data = {
        ...data,
        startDate: form.startDate, endDate: form.endDate,
        showType: form.showType, office: form.office,
        boothSize: form.boothSize ? parseInt(form.boothSize) : null,
      }
    } else if (form.type === 'seasonal_kv') {
      const r = { ...DEFAULT_RULES, ...rules }
      // startDate = kickoff (kvKickoff weeks before event)
      // endDate = event date
      const kickoffDate = addDays(form.kvEventDate, -(r.kvKickoff * 7))
      data = {
        ...data,
        startDate: kickoffDate,
        endDate: form.kvEventDate,
        kvCategory: form.kvCategory,
        kvRegion: form.kvRegion,
        note: form.kvNote,
      }
    } else {
      data = {
        ...data,
        startDate: form.startDate, endDate: form.endDate,
      }
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

  // For Seasonal KV form: compute preview dates
  const kvPreviewKickoff = form.type === 'seasonal_kv' && form.kvEventDate
    ? addDays(form.kvEventDate, -((rules.kvKickoff || DEFAULT_RULES.kvKickoff) * 7))
    : null
  const kvPreviewRelease = form.type === 'seasonal_kv' && form.kvEventDate
    ? addDays(form.kvEventDate, -((rules.kvRelease || DEFAULT_RULES.kvRelease) * 7))
    : null

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
            {[['all', '全部'], ['tradeshow', '秀展'], ['event', '活動'], ['award', '報獎'], ['seasonal_kv', 'KV']].map(([val, label]) => (
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
              const loadingLevel = p.type === 'tradeshow' ? getLoadingLevel(p.boothSize, p.name) : null
              const loadingStyle = loadingLevel ? LOADING_COLORS[loadingLevel] : null
              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-1 h-12 rounded-full flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: TYPE_COLORS[p.type] }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-gray-800 truncate">{p.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${TYPE_BG[p.type]}`}>
                            {TYPE_LABELS[p.type]}
                          </span>
                          {p.subtype && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">{p.subtype}</span>
                          )}
                          {loadingLevel && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{ backgroundColor: loadingStyle.bg, color: loadingStyle.text }}>
                              {loadingLevel}
                            </span>
                          )}
                          {p.boothSize > 0 && (
                            <span className="text-xs text-gray-400 flex-shrink-0">{p.boothSize} 攤位</span>
                          )}
                          {p.datePending && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 flex-shrink-0">日期待定</span>
                          )}
                          {/* KV extra info */}
                          {p.type === 'seasonal_kv' && p.kvRegion && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">{p.kvRegion}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                          {p.startDate && <span>📅 {p.startDate} ~ {p.endDate}</span>}
                          {p.location && <span>📍 {p.location}</span>}
                          {p.showType && <span>🏷 {p.showType}</span>}
                          {p.type === 'seasonal_kv' && p.kvCategory && <span>🏷 {p.kvCategory}</span>}
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
                <div className="flex flex-wrap gap-2">
                  {[['tradeshow', '秀展'], ['event', '活動'], ['award', '報獎'], ['seasonal_kv', 'Seasonal KV']].map(([val, label]) => (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {form.type === 'seasonal_kv' ? '節慶名稱 *' : '專案名稱 *'}
                </label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={form.type === 'seasonal_kv' ? '例：農曆新年' : '例：Computex 2026'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Seasonal KV specific fields */}
              {form.type === 'seasonal_kv' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">節慶日期 *</label>
                    <input type="date" value={form.kvEventDate} onChange={e => setForm(f => ({ ...f, kvEventDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
                    <p className="text-xs text-gray-400 mt-1">KV 發稿與發佈日期會依里程碑設定自動計算</p>
                  </div>
                  {kvPreviewKickoff && (
                    <div className="bg-pink-50 rounded-lg px-4 py-3 text-sm space-y-1">
                      <p className="font-medium text-pink-700 mb-1">自動計算預覽</p>
                      <p className="text-pink-600">📋 發稿（Kick off）：{kvPreviewKickoff}</p>
                      <p className="text-pink-600">🚀 發佈KV：{kvPreviewRelease}</p>
                      <p className="text-pink-600">🎯 節慶日期：{form.kvEventDate}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">類別</label>
                      <select value={form.kvCategory} onChange={e => setForm(f => ({ ...f, kvCategory: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="">請選擇</option>
                        {KV_CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                      <select value={form.kvRegion} onChange={e => setForm(f => ({ ...f, kvRegion: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        {KV_REGIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                    <input value={form.kvNote} onChange={e => setForm(f => ({ ...f, kvNote: e.target.value }))}
                      placeholder="例：eCard"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
                  </div>
                </>
              )}

              {/* Dates (non-seasonal_kv) */}
              {form.type !== 'seasonal_kv' && (
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
              )}

              {/* Location (non-seasonal_kv) */}
              {form.type !== 'seasonal_kv' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">地點</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="例：Taipei, TW"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}

              {/* Show type + booth size (tradeshow only) */}
              {form.type === 'tradeshow' && (
                <div className="grid grid-cols-3 gap-3">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">攤位數量</label>
                    <input type="number" min="0" value={form.boothSize} onChange={e => setForm(f => ({ ...f, boothSize: e.target.value }))}
                      placeholder="攤位數"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}
              {/* Loading level preview for tradeshow */}
              {form.type === 'tradeshow' && (form.boothSize || form.name) && (() => {
                const lvl = getLoadingLevel(form.boothSize, form.name)
                if (!lvl) return null
                const style = LOADING_COLORS[lvl]
                return (
                  <div className="rounded-lg px-4 py-2 text-sm font-medium"
                    style={{ backgroundColor: style.bg, color: style.text }}>
                    Loading：{lvl}（{form.name?.toUpperCase().includes('COMPUTEX') ? 'COMPUTEX 固定高度' : `${form.boothSize} 攤位`}）
                  </div>
                )
              })()}

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
                {planners.length > 0 && form.type !== 'seasonal_kv' && (
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
              <button onClick={handleSave}
                disabled={saving || !form.name || (form.type === 'seasonal_kv' ? !form.kvEventDate : (!form.startDate || !form.endDate))}
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
