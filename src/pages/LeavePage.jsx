import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const LEAVE_TYPES = ['特休', '病假', '事假', '出差', '其他']

const LEAVE_COLORS = {
  '特休': '#8b5cf6',
  '病假': '#f59e0b',
  '事假': '#6b7280',
  '出差': '#0ea5e9',
  '其他': '#d1d5db',
}

const emptyForm = {
  personId: '', startDate: '', endDate: '', type: '特休', note: ''
}

export default function LeavePage() {
  const { isAdmin } = useAuth()
  const [people, setPeople] = useState([])
  const [leaves, setLeaves] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editLeave, setEditLeave] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [filterPerson, setFilterPerson] = useState('all')
  const [filterMonth, setFilterMonth] = useState('')

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'people'), snap =>
      setPeople(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name))))
    const u2 = onSnapshot(collection(db, 'leaves'), snap =>
      setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    return () => { u1(); u2() }
  }, [])

  function openCreate() {
    setEditLeave(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(leave) {
    setEditLeave(leave)
    setForm({ personId: leave.personId, startDate: leave.startDate, endDate: leave.endDate, type: leave.type, note: leave.note || '' })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.personId || !form.startDate || !form.endDate) return
    setSaving(true)
    const person = people.find(p => p.id === form.personId)
    const data = {
      personId: form.personId,
      personName: person?.name || '',
      startDate: form.startDate,
      endDate: form.endDate,
      type: form.type,
      note: form.note,
      updatedAt: new Date().toISOString(),
    }
    try {
      if (editLeave) {
        await updateDoc(doc(db, 'leaves', editLeave.id), data)
      } else {
        await addDoc(collection(db, 'leaves'), { ...data, createdAt: new Date().toISOString() })
      }
      setShowModal(false)
    } catch (err) {
      alert('儲存失敗：' + err.message)
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    await deleteDoc(doc(db, 'leaves', id))
    setDeleteConfirm(null)
  }

  const filtered = leaves
    .filter(l => filterPerson === 'all' || l.personId === filterPerson)
    .filter(l => !filterMonth || l.startDate?.startsWith(filterMonth) || l.endDate?.startsWith(filterMonth))
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))

  const days = (leave) => {
    if (!leave.startDate || !leave.endDate) return 0
    return Math.round((new Date(leave.endDate) - new Date(leave.startDate)) / 86400000) + 1
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h2 className="text-xl font-bold text-gray-800">休假預排</h2>
          <p className="text-sm text-gray-400">{filtered.length} 筆休假記錄</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Person filter */}
          <select value={filterPerson} onChange={e => setFilterPerson(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700">
            <option value="all">全部成員</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {/* Month filter */}
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700" />
          {filterMonth && (
            <button onClick={() => setFilterMonth('')} className="text-xs text-gray-400 hover:text-gray-600">✕ 清除</button>
          )}
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
            + 新增休假
          </button>
        </div>
      </div>

      {/* Leave list */}
      <div className="flex-1 overflow-auto p-6">
        {/* Type legend */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {LEAVE_TYPES.map(t => (
            <div key={t} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: LEAVE_COLORS[t] }} />
              <span className="text-xs text-gray-500">{t}</span>
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">🏖️</div>
              <p>尚無休假記錄</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            {filtered.map(leave => {
              const person = people.find(p => p.id === leave.personId)
              return (
                <div key={leave.id} className="bg-white rounded-xl border border-gray-200 px-5 py-3.5 flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: LEAVE_COLORS[leave.type] || '#d1d5db' }} />
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 ${person?.role === 'designer' ? 'bg-purple-500' : 'bg-teal-500'}`}>
                      {person?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{person?.name || leave.personName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: LEAVE_COLORS[leave.type] }}>{leave.type}</span>
                        <span className="text-xs text-gray-400">{days(leave)} 天</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {leave.startDate} ~ {leave.endDate}
                        {leave.note && <span className="text-gray-400 ml-2">· {leave.note}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(leave)} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50">編輯</button>
                    <button onClick={() => setDeleteConfirm(leave.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">刪除</button>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">{editLeave ? '編輯休假' : '新增休假'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Person */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">成員 *</label>
                <select value={form.personId} onChange={e => setForm(f => ({ ...f, personId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="">請選擇成員</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name} ({p.role === 'designer' ? '設計師' : 'Planner'})</option>)}
                </select>
              </div>
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">假別</label>
                <div className="flex flex-wrap gap-2">
                  {LEAVE_TYPES.map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={`px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-colors ${form.type === t ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      style={form.type === t ? { backgroundColor: LEAVE_COLORS[t], borderColor: LEAVE_COLORS[t] } : {}}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日期 *</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">結束日期 *</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註（選填）</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="例：回國、蜜月旅行"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              {/* Days preview */}
              {form.startDate && form.endDate && form.endDate >= form.startDate && (
                <div className="bg-purple-50 rounded-lg px-4 py-2 text-sm text-purple-700">
                  共 {Math.round((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1} 天
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleSave} disabled={saving || !form.personId || !form.startDate || !form.endDate}
                className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 font-medium">
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
            <p className="text-sm text-gray-500 mb-6">確定要刪除這筆休假記錄嗎？</p>
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
