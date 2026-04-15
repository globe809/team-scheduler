import { useState, useRef } from 'react'
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { parseTradeShowExcel } from '../utils/excelParser'

export default function ImportPage() {
  const { isAdmin } = useAuth()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importing, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef()

  async function handleFile(f) {
    setFile(f)
    setPreview(null)
    setResult(null)
    setError('')
    try {
      const rows = await parseTradeShowExcel(f)
      setPreview(rows)
    } catch (e) {
      setError('解析失敗：' + e.message)
    }
  }

  async function handleImport() {
    if (!preview) return
    setSaving(true)
    setResult(null)
    try {
      const existingSnap = await getDocs(collection(db, 'projects'))
      const existing = {}
      existingSnap.docs.forEach(d => {
        const data = d.data()
        if (data.type === 'tradeshow') existing[data.name] = { id: d.id, ...data }
      })

      let added = 0, updated = 0, skipped = 0

      for (const row of preview) {
        if (!row.startDate && !row.datePending) { skipped++; continue }
        if (existing[row.name]) {
          // Update: only update non-assignment fields
          const current = existing[row.name]
          const updates = {
            startDate: row.startDate || current.startDate,
            endDate: row.endDate || current.endDate,
            location: row.location || current.location,
            showType: row.showType || current.showType,
            office: row.office || current.office,
            status: row.status || current.status,
            year: row.year,
            datePending: row.datePending || false,
            updatedAt: new Date().toISOString(),
          }
          await updateDoc(doc(db, 'projects', current.id), updates)
          updated++
        } else {
          // Add new
          await addDoc(collection(db, 'projects'), {
            ...row,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          added++
        }
      }

      setResult({ added, updated, skipped, total: preview.length })
      setPreview(null)
      setFile(null)
    } catch (e) {
      setError('匯入失敗：' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">🔒</div>
          <p>只有管理者可以匯入資料</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white">
        <h2 className="text-xl font-bold text-gray-800">匯入 Excel</h2>
        <p className="text-sm text-gray-400">上傳秀展清單 .xlsx 檔案，系統自動新增或更新秀展資料（不影響已指派的人員）</p>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-2xl">
        {/* Upload area */}
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${file ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]) }} />
          <div className="text-4xl mb-3">{file ? '📄' : '📥'}</div>
          {file ? (
            <div>
              <p className="font-medium text-blue-700">{file.name}</p>
              <p className="text-sm text-gray-400 mt-1">點擊重新選擇</p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-gray-700">拖拉或點擊上傳 Excel 檔案</p>
              <p className="text-sm text-gray-400 mt-1">支援 .xlsx 格式（從 Google Sheet 匯出）</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
        )}

        {/* Preview */}
        {preview && preview.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">匯入預覽（{preview.length} 筆）</h3>
              <button onClick={handleImport} disabled={importing}
                className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 font-medium">
                {importing ? '匯入中…' : '確認匯入'}
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">秀展名稱</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">日期</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">地點</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">類型</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">狀態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {row.datePending ? <span className="text-yellow-600 text-xs">日期待定</span> : `${row.startDate} ~ ${row.endDate}`}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{row.location}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{row.showType}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className={`px-2 py-0.5 rounded-full ${row.status === '已結束' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                            {row.status || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              ⚠️ 現有秀展（相同名稱）只會更新日期、地點等欄位，不會影響已指派的設計師和 Planner。
            </p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-800 mb-3">✅ 匯入完成</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center bg-white rounded-lg p-3">
                <p className="text-2xl font-bold text-emerald-600">{result.added}</p>
                <p className="text-xs text-gray-500 mt-0.5">新增</p>
              </div>
              <div className="text-center bg-white rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                <p className="text-xs text-gray-500 mt-0.5">更新</p>
              </div>
              <div className="text-center bg-white rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-400">{result.skipped}</p>
                <p className="text-xs text-gray-500 mt-0.5">略過</p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-gray-50 rounded-xl p-5 text-sm text-gray-600">
          <h3 className="font-semibold text-gray-700 mb-3">📋 使用說明</h3>
          <ol className="space-y-2 list-decimal list-inside">
            <li>開啟 Google Sheet 秀展清單</li>
            <li>點選「檔案 → 下載 → Microsoft Excel (.xlsx)」</li>
            <li>將下載的檔案拖拉到上方區域，或點擊選擇</li>
            <li>確認預覽內容後，點擊「確認匯入」</li>
          </ol>
          <p className="mt-3 text-gray-400">系統會自動根據日期格式（如 1/11~1/13）加入正確年份，跨年情形也會自動判斷。</p>
        </div>
      </div>
    </div>
  )
}
