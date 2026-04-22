import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

// ── Contract data (from signed contract 民國 113–115 年) ──────────────────────
const PAYMENT_SCHEDULE = [
  // Contract Year 113 (2024)
  { id: '113-1', contractYear: 113, period: 1, label: '第一期款', amount: 150, dueDate: '2024-11-01' },
  { id: '113-2', contractYear: 113, period: 2, label: '第二期款', amount: 150, dueDate: '2025-03-30' },
  { id: '113-3', contractYear: 113, period: 3, label: '第三期款', amount: 70,  dueDate: '2025-07-31' },
  // Contract Year 114 (2025)
  { id: '114-1', contractYear: 114, period: 1, label: '第一期款', amount: 150, dueDate: '2025-11-01' },
  { id: '114-2', contractYear: 114, period: 2, label: '第二期款', amount: 150, dueDate: '2026-03-30' },
  { id: '114-3', contractYear: 114, period: 3, label: '第三期款', amount: 70,  dueDate: '2026-07-31' },
  // Contract Year 115 (2026)
  { id: '115-1', contractYear: 115, period: 1, label: '第一期款', amount: 150, dueDate: '2026-11-01' },
  { id: '115-2', contractYear: 115, period: 2, label: '第二期款', amount: 150, dueDate: '2027-03-30' },
  { id: '115-3', contractYear: 115, period: 3, label: '第三期款', amount: 70,  dueDate: '2027-07-31' },
]

// ── Sponsored events from contract appendix ───────────────────────────────────
const EVENT_TEMPLATES = [
  { key: 'hbl_ab',   name: '高中籃球聯賽甲級（預賽→決賽）、乙級（決賽）', icon: '🏀', shortName: 'HBL 甲/乙級' },
  { key: 'jbl_a',    name: '國中籃球聯賽甲級（決賽）',                      icon: '🏀', shortName: '國中籃球甲級' },
  { key: 'hvl_a',    name: '高中排球聯賽甲級（複賽→決賽）',                  icon: '🏐', shortName: '高中排球甲級' },
  { key: 'jvl_a',    name: '國中排球聯賽甲級（決賽）',                       icon: '🏐', shortName: '國中排球甲級' },
  { key: 'soccer',   name: '中等學校足球聯賽 11 人制（決賽）',                icon: '⚽', shortName: '足球 11 人制' },
  { key: 'softball', name: '中小學女子壘球聯賽高中組、國中甲級（決賽）',       icon: '🥎', shortName: '女子壘球聯賽' },
  { key: 'dance',    name: '全國中等學校熱舞大賽（預賽→決賽）',               icon: '💃', shortName: '全國熱舞大賽' },
  { key: 'bball3',   name: '中等學校 3X3 籃球錦標賽（決賽）',                icon: '🏀', shortName: '3X3 籃球錦標賽' },
  { key: 'allstar',  name: '高中籃球全明星賽',                               icon: '⭐', shortName: 'HBL 全明星賽' },
]

const ROC_TO_GREG = { 113: 2024, 114: 2025, 115: 2026 }
const CONTRACT_YEAR_OPTIONS = [2024, 2025, 2026]

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysFromToday(dateStr) {
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
}

export default function SponsorPage() {
  const [paymentStatus, setPaymentStatus] = useState({})
  const [eventDates, setEventDates]       = useState({})
  const [activeTab, setActiveTab]         = useState('payments')
  const [filterYear, setFilterYear]       = useState(new Date().getFullYear() <= 2026 ? new Date().getFullYear() : 2026)
  const [editingKey, setEditingKey]       = useState(null)
  const [editForm, setEditForm]           = useState({ startDate: '', finalsDate: '', note: '' })
  const [saving, setSaving]               = useState(false)

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'hblPayments'), snap => {
      const d = {}
      snap.docs.forEach(s => { d[s.id] = s.data() })
      setPaymentStatus(d)
    })
    const u2 = onSnapshot(collection(db, 'hblEvents'), snap => {
      const d = {}
      snap.docs.forEach(s => { d[s.id] = s.data() })
      setEventDates(d)
    })
    return () => { u1(); u2() }
  }, [])

  // Toggle paid status for a payment
  async function togglePaid(paymentId, currentPaid) {
    await setDoc(doc(db, 'hblPayments', paymentId), {
      paid: !currentPaid,
      paidDate: !currentPaid ? new Date().toISOString().split('T')[0] : '',
    }, { merge: true })
  }

  // Open inline edit for an event
  function startEdit(year, eventKey) {
    const id = `${year}-${eventKey}`
    const existing = eventDates[id] || {}
    setEditForm({ startDate: existing.startDate || '', finalsDate: existing.finalsDate || '', note: existing.note || '' })
    setEditingKey(id)
  }

  async function saveEdit(year, eventKey) {
    const id = `${year}-${eventKey}`
    setSaving(true)
    await setDoc(doc(db, 'hblEvents', id), {
      year, eventKey, ...editForm,
      updatedAt: new Date().toISOString(),
    }, { merge: true })
    setSaving(false)
    setEditingKey(null)
  }

  // Compute event status for display
  function getEventStatus(year, eventKey) {
    const data = eventDates[`${year}-${eventKey}`]
    if (!data?.startDate && !data?.finalsDate) return { tag: '未排定', tagCls: 'bg-gray-100 text-gray-400', progress: null }

    const today = new Date(); today.setHours(0, 0, 0, 0)

    if (data.finalsDate) {
      const finals = new Date(data.finalsDate)
      if (today > finals) return { tag: '已結束', tagCls: 'bg-gray-100 text-gray-500', progress: 100 }
    }
    if (data.startDate) {
      const start = new Date(data.startDate)
      if (today < start) {
        const d = Math.round((start - today) / 86400000)
        return {
          tag: `${d} 天後開始`, tagCls: 'bg-blue-100 text-blue-600',
          progress: null,
        }
      }
      if (data.finalsDate) {
        const finals = new Date(data.finalsDate)
        const pct = Math.min(100, Math.round(((today - start) / (finals - start)) * 100))
        return { tag: `進行中 ${pct}%`, tagCls: 'bg-orange-100 text-orange-600', progress: pct }
      }
      return { tag: '進行中', tagCls: 'bg-orange-100 text-orange-600', progress: null }
    }
    return { tag: '日期部分設定', tagCls: 'bg-yellow-100 text-yellow-600', progress: null }
  }

  // ── Stats ──
  const paidPayments  = PAYMENT_SCHEDULE.filter(p => paymentStatus[p.id]?.paid)
  const paidAmount    = paidPayments.reduce((s, p) => s + p.amount, 0)
  const overdueList   = PAYMENT_SCHEDULE.filter(p => !paymentStatus[p.id]?.paid && daysFromToday(p.dueDate) < 0)
  const overdueAmount = overdueList.reduce((s, p) => s + p.amount, 0)

  // Events set for filterYear
  const eventsWithDates = EVENT_TEMPLATES.filter(e => eventDates[`${filterYear}-${e.key}`]?.startDate).length

  return (
    <div className="flex flex-col h-full">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h2 className="text-xl font-bold text-gray-800">高中體總贊助管理</h2>
          <p className="text-sm text-gray-400">中華民國高中體育總會 · 合約年度：民國 113–115 年（2024–2026）</p>
        </div>
        <a href="https://www.hhsaa.org.tw" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors">
          高中體總官網 ↗
        </a>
      </div>

      {/* ── Summary cards ── */}
      <div className="px-6 py-4 grid grid-cols-4 gap-3 border-b bg-gray-50/60">
        {/* Annual */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">年贊助金額</p>
          <p className="text-2xl font-bold text-gray-800 mt-0.5">370 <span className="text-sm font-normal text-gray-400">萬</span></p>
          <p className="text-xs text-gray-400">含稅 · 共 3 期</p>
        </div>
        {/* Total */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">合約總金額</p>
          <p className="text-2xl font-bold text-gray-800 mt-0.5">1,110 <span className="text-sm font-normal text-gray-400">萬</span></p>
          <p className="text-xs text-gray-400">3 年合計 · 9 期</p>
        </div>
        {/* Paid */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">已付款</p>
          <p className="text-2xl font-bold text-emerald-600 mt-0.5">{paidAmount} <span className="text-sm font-normal text-gray-400">萬</span></p>
          <p className="text-xs text-gray-400">{paidPayments.length}/9 期完成</p>
        </div>
        {/* Overdue */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">逾期未付</p>
          <p className={`text-2xl font-bold mt-0.5 ${overdueList.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>
            {overdueList.length} <span className="text-sm font-normal text-gray-400">筆</span>
          </p>
          <p className="text-xs text-gray-400">
            {overdueList.length > 0 ? `共 ${overdueAmount} 萬元` : '全部正常 ✓'}
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="px-6 bg-white border-b flex gap-0">
        {[['payments', '💳 付款進度'], ['events', '🏅 贊助賽事']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-auto p-6">

        {/* ════════ PAYMENT SCHEDULE ════════ */}
        {activeTab === 'payments' && (
          <div className="space-y-5 max-w-2xl">
            {[113, 114, 115].map(rocYear => {
              const gregYear = ROC_TO_GREG[rocYear]
              const yearPayments = PAYMENT_SCHEDULE.filter(p => p.contractYear === rocYear)
              const yearPaid = yearPayments.reduce((s, p) => s + (paymentStatus[p.id]?.paid ? p.amount : 0), 0)
              const yearPct = Math.round((yearPaid / 370) * 100)

              return (
                <div key={rocYear} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Year header */}
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-800">民國 {rocYear} 年度</span>
                      <span className="text-xs text-gray-400">（{gregYear} 年合約）</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-28 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${yearPct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-20 text-right">
                        {yearPaid} / 370 萬
                      </span>
                    </div>
                  </div>

                  {/* Payment rows */}
                  <div className="divide-y divide-gray-100">
                    {yearPayments.map(payment => {
                      const pData = paymentStatus[payment.id] || {}
                      const isPaid = !!pData.paid
                      const days = daysFromToday(payment.dueDate)

                      let statusEl
                      if (isPaid) {
                        statusEl = (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                            ✓ 已付款{pData.paidDate ? ` · ${pData.paidDate}` : ''}
                          </span>
                        )
                      } else if (days < 0) {
                        statusEl = (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                            ⚠ 逾期 {Math.abs(days)} 天
                          </span>
                        )
                      } else if (days <= 30) {
                        statusEl = (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded-full">
                            ⏰ {days} 天後到期
                          </span>
                        )
                      } else {
                        statusEl = (
                          <span className="text-xs text-gray-400">{days} 天後到期</span>
                        )
                      }

                      return (
                        <div key={payment.id}
                          className={`flex items-center justify-between px-5 py-3.5 transition-colors ${isPaid ? 'bg-emerald-50/30' : ''}`}>
                          <div className="flex items-center gap-4">
                            {/* Toggle paid */}
                            <button
                              onClick={() => togglePaid(payment.id, isPaid)}
                              title={isPaid ? '取消付款標記' : '標記為已付款'}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                ${isPaid
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'}`}>
                              {isPaid && <span className="text-xs font-bold">✓</span>}
                            </button>
                            <div>
                              <p className={`text-sm font-medium ${isPaid ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                {payment.label}
                              </p>
                              <p className="text-xs text-gray-400">到期日：{payment.dueDate}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            {statusEl}
                            <span className={`text-base font-bold w-16 text-right ${isPaid ? 'text-gray-300' : 'text-gray-800'}`}>
                              {payment.amount} 萬
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Summary row */}
            <div className="bg-gray-800 rounded-xl px-5 py-4 flex items-center justify-between text-white">
              <div>
                <p className="text-sm font-semibold">合約總計</p>
                <p className="text-xs text-gray-400 mt-0.5">民國 113–115 年 · 9 期款項</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{paidAmount} / 1,110 <span className="text-sm font-normal text-gray-400">萬</span></p>
                <p className="text-xs text-gray-400 mt-0.5">{paidPayments.length} / 9 期已付</p>
              </div>
            </div>
          </div>
        )}

        {/* ════════ EVENTS LIST ════════ */}
        {activeTab === 'events' && (
          <div>
            {/* Year filter + stats */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                {CONTRACT_YEAR_OPTIONS.map(y => (
                  <button key={y} onClick={() => setFilterYear(y)}
                    className={`px-4 py-1.5 ${filterYear === y ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    {y} 年
                  </button>
                ))}
              </div>
              <span className="text-sm text-gray-400">
                {eventsWithDates}/{EVENT_TEMPLATES.length} 個賽事已設定日期
              </span>
              <div className="ml-auto text-xs text-gray-400 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
                💡 日期公布後請至官網查詢，手動填入各賽事區間
              </div>
            </div>

            {/* Events */}
            <div className="space-y-2 max-w-3xl">
              {EVENT_TEMPLATES.map((event, idx) => {
                const id = `${filterYear}-${event.key}`
                const data = eventDates[id] || {}
                const isEditing = editingKey === id
                const status = getEventStatus(filterYear, event.key)

                return (
                  <div key={event.key}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">

                        {/* Left: icon + info */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className="text-xl flex-shrink-0 mt-0.5 select-none">{event.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-400 font-medium">({idx + 1})</span>
                              <p className="text-sm font-medium text-gray-800">{event.name}</p>
                            </div>

                            {/* Date range display */}
                            {!isEditing && (
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {data.startDate ? (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    📅 {data.startDate}
                                    {data.finalsDate && ` → 決賽 ${data.finalsDate}`}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-300 italic">尚未設定賽事日期</span>
                                )}
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.tagCls}`}>
                                  {status.tag}
                                </span>
                                {data.note && (
                                  <span className="text-xs text-gray-400">· {data.note}</span>
                                )}
                              </div>
                            )}

                            {/* Progress bar */}
                            {!isEditing && status.progress !== null && status.progress < 100 && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="w-40 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-orange-400 rounded-full transition-all"
                                    style={{ width: `${status.progress}%` }} />
                                </div>
                                <span className="text-xs text-gray-400">{status.progress}%</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Edit button */}
                        {!isEditing && (
                          <button onClick={() => startEdit(filterYear, event.key)}
                            className="text-xs text-blue-500 hover:text-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors flex-shrink-0 font-medium">
                            {data.startDate ? '編輯' : '設定日期'}
                          </button>
                        )}
                      </div>

                      {/* ── Inline edit form ── */}
                      {isEditing && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">開賽日期</label>
                              <input type="date" value={editForm.startDate}
                                onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">決賽日期</label>
                              <input type="date" value={editForm.finalsDate}
                                onChange={e => setEditForm(f => ({ ...f, finalsDate: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          </div>
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">備註（場館、地點等）</label>
                            <input type="text" value={editForm.note}
                              onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                              placeholder="例：台北小巨蛋、新莊體育館"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          {/* Date span preview */}
                          {editForm.startDate && editForm.finalsDate && editForm.finalsDate >= editForm.startDate && (
                            <div className="mb-3 bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                              賽程共 {Math.round((new Date(editForm.finalsDate) - new Date(editForm.startDate)) / 86400000) + 1} 天
                              （{editForm.startDate} → {editForm.finalsDate}）
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <a href="https://www.hhsaa.org.tw" target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-600">
                              前往官網查詢賽程 ↗
                            </a>
                            <div className="flex gap-2">
                              <button onClick={() => setEditingKey(null)}
                                className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
                              <button onClick={() => saveEdit(filterYear, event.key)} disabled={saving}
                                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
                                {saving ? '儲存中…' : '儲存'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
