// Default milestone rules (weeks before show start)
export const DEFAULT_RULES = {
  designerStart: 8,     // 設計師開始設計海報
  plannerStart: 8,      // Planner 開始規劃內容
  invitationLetter: 4,  // 邀請函準備
  pressRelease: 2,      // 新聞稿發布
  linkedinPreview: 1,   // LinkedIn 預告
  linkedinPost: 0,      // LinkedIn 當天發文（開展日）
  kvKickoff: 6,         // Seasonal KV: 發稿給設計師（活動前幾週）
  kvRelease: 4,         // Seasonal KV: 發佈KV給業務（活動前幾週）
}

export const MILESTONE_LABELS = {
  designerStart: '設計師開始',
  plannerStart: 'Planner 開始',
  invitationLetter: '邀請函',
  pressRelease: '新聞稿',
  linkedinPreview: 'LinkedIn 預告',
  linkedinPost: 'LinkedIn 發文',
}

export const TYPE_COLORS = {
  tradeshow: '#3B82F6',
  event: '#F97316',
  award: '#10B981',
  seasonal_kv: '#EC4899',
}

export const TYPE_LABELS = {
  tradeshow: '秀展',
  event: '活動',
  award: '報獎',
  seasonal_kv: 'Seasonal KV',
}

export const TYPE_BG = {
  tradeshow: 'bg-blue-100 text-blue-700',
  event: 'bg-orange-100 text-orange-700',
  award: 'bg-emerald-100 text-emerald-700',
  seasonal_kv: 'bg-pink-100 text-pink-700',
}

// Loading level based on booth count and project name
export function getLoadingLevel(boothSize, projectName) {
  if (projectName && projectName.toUpperCase().includes('COMPUTEX')) return '高度'
  const count = parseInt(boothSize) || 0
  if (count <= 0) return null
  if (count >= 9) return '高度'
  if (count >= 5) return '中度'
  return '輕度'
}

export const LOADING_COLORS = {
  '輕度': { bg: '#bfdbfe', text: '#1e40af' },
  '中度': { bg: '#fed7aa', text: '#9a3412' },
  '高度': { bg: '#fca5a5', text: '#7f1d1d' },
}

/**
 * Subtract weeks from a date
 */
function subWeeks(date, weeks) {
  const d = new Date(date)
  d.setDate(d.getDate() - weeks * 7)
  return d
}

/**
 * Calculate work start date for a person based on their role and milestone rules
 */
export function getWorkStart(projectStartDate, role, rules) {
  const r = { ...DEFAULT_RULES, ...rules }
  const start = new Date(projectStartDate)
  if (role === 'designer') return subWeeks(start, r.designerStart)
  return subWeeks(start, r.plannerStart)
}

/**
 * Get all milestone dates for a trade show project (planner only)
 */
export function getMilestones(projectStartDate, rules) {
  const r = { ...DEFAULT_RULES, ...rules }
  const start = new Date(projectStartDate)
  return [
    { key: 'invitationLetter', date: subWeeks(start, r.invitationLetter), label: '邀請函' },
    { key: 'pressRelease', date: subWeeks(start, r.pressRelease), label: '新聞稿' },
    { key: 'linkedinPreview', date: subWeeks(start, r.linkedinPreview), label: 'LinkedIn 預告' },
    { key: 'linkedinPost', date: start, label: 'LinkedIn 發文' },
  ]
}

/**
 * Get Seasonal KV milestone dates (kickoff → release → event date)
 */
export function getKVMilestones(eventDate, rules) {
  const r = { ...DEFAULT_RULES, ...rules }
  return [
    { key: 'kvRelease', date: subWeeks(new Date(eventDate), r.kvRelease), label: '發佈KV' },
  ]
}

/**
 * Build gantt bars for a person across all projects
 */
export function buildBarsForPerson(personId, projects, rules) {
  const bars = []
  for (const project of projects) {
    // Find assignments for this person
    const assignments = (project.assignments || []).filter(a => a.personId === personId)
    for (const assignment of assignments) {
      let workStart, workEnd, milestones

      if (project.type === 'tradeshow') {
        workStart = getWorkStart(project.startDate, assignment.role, rules)
        workEnd = new Date(project.endDate)
        milestones = assignment.role === 'planner' ? getMilestones(project.startDate, rules) : []
      } else if (project.type === 'seasonal_kv') {
        // For seasonal_kv: startDate = kickoff, endDate = event date, releaseDate = milestone
        workStart = new Date(project.startDate)
        workEnd = new Date(project.endDate)
        milestones = project.endDate ? getKVMilestones(project.endDate, rules) : []
      } else {
        workStart = new Date(project.startDate)
        workEnd = new Date(project.endDate)
        milestones = []
      }

      bars.push({
        projectId: project.id,
        projectName: project.name,
        type: project.type,
        role: assignment.role,
        workStart,
        workEnd,
        color: TYPE_COLORS[project.type] || '#6B7280',
        milestones,
        loadingLevel: project.type === 'tradeshow'
          ? getLoadingLevel(project.boothSize, project.name)
          : null,
        boothSize: project.boothSize || null,
      })
    }
  }
  return bars
}
