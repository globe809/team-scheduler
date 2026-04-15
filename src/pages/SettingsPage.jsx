import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { DEFAULT_RULES, MILESTONE_LABELS } from '../utils/milestoneUtils'

const MILESTONE_DESCRIPTIONS = {
  designerStart: '設計師開始設計海報的時間（秀展前幾週）',
  plannerStart: 'Planner 開始規劃內容的時間（秀展前幾週）',
  invitationLetter: '準備邀請函的時間（秀展前幾週）',
  pressRelease: '發布新聞稿的時間（秀展前幾週）',
  linkedinPreview: '在 LinkedIn 發布預告的時間（秀展前幾週）',
  linkedinPost: '在 LinkedIn 發布開展當天貼文（填 0 = 開展當天）',
}

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const [rules, setRules] = useState(DEFAULT_RULES)
  const [original, setOriginal] = useState(DEFAULT_RULES)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRules = async () => {
      const rd = await getDoc(doc(db, 'settings', 'milestoneRules'))
      if (rd.exists()) {
        const data = { ...DEFAULT_RULES, ...rd.data() }
        setRules(data)
        setOriginal(data)
      }
      setLoading(false)
    }
    loadRules()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'milestoneRules'), rules)
      setOriginal(rules)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setRules(DEFAULT_RULES)
  }

  const hasChanges = JSON.stringify(rules) !== JSON.stringify(original)

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">載入中…</div>

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h2 className="text-xl font-bold text-gray-800">里程碑設定</h2>
          <p className="text-sm text-gray-400">調整秀展各工作項目的預設提前週數</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {saved && <span className="text-sm text-emerald-600 font-medium">✓ 已儲存</span>}
            <button onClick={handleReset} className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">
              還原預設
            </button>
            <button onClick={handleSave} disabled={saving || !hasChanges}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-medium">
              {saving ? '儲存中…' : '儲存設定'}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
            <p className="text-sm text-blue-700">
              💡 以下設定僅適用於<strong>秀展</strong>類型。活動和報獎的日期範圍需手動填寫。
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {Object.entries(DEFAULT_RULES).map(([key]) => (
              <div key={key} className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 mr-6">
                  <p className="text-sm font-medium text-gray-800">{MILESTONE_LABELS[key]}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{MILESTONE_DESCRIPTIONS[key]}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isAdmin ? (
                    <>
                      <button
                        onClick={() => setRules(r => ({ ...r, [key]: Math.max(0, r[key] - 1) }))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold"
                        disabled={rules[key] <= 0}
                      >−</button>
                      <span className="w-10 text-center text-sm font-semibold text-gray-800">{rules[key]}</span>
                      <button
                        onClick={() => setRules(r => ({ ...r, [key]: r[key] + 1 }))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold"
                      >+</button>
                      <span className="text-sm text-gray-400 w-8">週前</span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-gray-800 w-20 text-right">
                      {rules[key] === 0 ? '當天' : `${rules[key]} 週前`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">📅 範例預覽（假設開展日：6/2）</h3>
          <div className="space-y-2">
            {[
              { key: 'designerStart', role: '設計師', label: '開始設計海報' },
              { key: 'plannerStart', role: 'Planner', label: '開始規劃內容' },
              { key: 'invitationLetter', role: 'Planner', label: '準備邀請函' },
              { key: 'pressRelease', role: 'Planner', label: '發布新聞稿' },
              { key: 'linkedinPreview', role: 'Planner', label: 'LinkedIn 預告' },
              { key: 'linkedinPost', role: 'Planner', label: 'LinkedIn 發文' },
            ].map(({ key, role, label }) => {
              const showDate = new Date(2026, 5, 2) // June 2, 2026
              const taskDate = new Date(showDate)
              taskDate.setDate(taskDate.getDate() - rules[key] * 7)
              return (
                <div key={key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${role === '設計師' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                      {role}
                    </span>
                    <span className="text-gray-600">{label}</span>
                  </div>
                  <span className="text-gray-800 font-medium">
                    {rules[key] === 0 ? '6/2（開展當天）' : taskDate.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {!isAdmin && (
          <p className="text-sm text-gray-400 mt-4 text-center">只有管理者可以修改設定</p>
        )}
      </div>
    </div>
  )
}
