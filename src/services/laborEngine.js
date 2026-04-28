/**
 * laborEngine.js
 *
 * Working day counter + labor cost calculator for the Philippines.
 * After the project_resources merge, labor items use:
 *   unit_cost_snapshot = daily rate
 *   quantity           = headcount (number of workers)
 *   working_days       = computed or stored working days
 *   labor_start_date   = optional override start
 *   labor_end_date     = optional override end
 */

// ── PH Public Holidays (recurring MM-DD) ─────────────
const PH_HOLIDAYS = new Set([
    '01-01', // New Year's Day
    '04-09', // Araw ng Kagitingan
    '05-01', // Labor Day
    '06-12', // Independence Day
    '08-21', // Ninoy Aquino Day
    '08-26', // National Heroes Day (last Mon Aug — approx)
    '11-01', // All Saints' Day
    '11-02', // All Souls' Day
    '11-30', // Bonifacio Day
    '12-08', // Immaculate Conception
    '12-24', // Christmas Eve
    '12-25', // Christmas Day
    '12-30', // Rizal Day
    '12-31', // New Year's Eve
    '02-25', // EDSA Revolution Anniversary
])

// Holy Week by year (Maundy Thursday + Good Friday)
const HOLY_WEEK = {
    2023: ['2023-04-06', '2023-04-07'],
    2024: ['2024-03-28', '2024-03-29'],
    2025: ['2025-04-17', '2025-04-18'],
    2026: ['2026-04-02', '2026-04-03'],
    2027: ['2027-03-25', '2027-03-26'],
    2028: ['2028-04-13', '2028-04-14'],
    2029: ['2029-04-05', '2029-04-06'],
    2030: ['2030-04-18', '2030-04-19'],
}

function toISODate(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${mm}-${dd}`
}

function toMMDD(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${mm}-${dd}`
}

function isWeekend(date) {
    const day = date.getDay()
    return day === 0 || day === 6
}

function isPHHoliday(date) {
    if (PH_HOLIDAYS.has(toMMDD(date))) return true
    const iso = toISODate(date)
    const hw = HOLY_WEEK[date.getFullYear()] || []
    return hw.includes(iso)
}

function isCustomHoliday(date, customHolidays = []) {
    const iso = toISODate(date)
    return customHolidays.some(h => h.date === iso)
}

/**
 * Count working days between start and end (inclusive).
 * Excludes: weekends, PH public holidays, custom holidays.
 */
export function countWorkingDays(start, end, customHolidays = []) {
    if (!start || !end) return 0
    const s = new Date(start); s.setHours(0, 0, 0, 0)
    const e = new Date(end); e.setHours(0, 0, 0, 0)
    if (s > e) return 0
    let count = 0
    const cur = new Date(s)
    while (cur <= e) {
        if (!isWeekend(cur) && !isPHHoliday(cur) && !isCustomHoliday(cur, customHolidays)) {
            count++
        }
        cur.setDate(cur.getDate() + 1)
    }
    return count
}

/**
 * Resolve working days and total cost for a labor line item.
 * Works with both old field names (daily_rate/headcount) and
 * new merged names (unit_cost_snapshot/quantity).
 */
export function resolveLaborItem(item, projectStartDate, projectEndDate, customHolidays = []) {
    const start = item.labor_start_date || item.start_date || projectStartDate
    const end = item.labor_end_date || item.end_date || projectEndDate

    const workingDays = countWorkingDays(start, end, customHolidays)

    // Support both old and new field names
    const dailyRate = parseFloat(item.unit_cost_snapshot ?? item.daily_rate ?? 0)
    const headcount = parseInt(item.quantity ?? item.headcount ?? 1)

    const totalCost = dailyRate * headcount * workingDays

    return { workingDays, totalCost }
}

/**
 * Calculate total labor cost directly.
 */
export function calcLaborCost({ dailyRate, headcount, workingDays }) {
    return (dailyRate || 0) * (headcount || 1) * (workingDays || 0)
}

/**
 * Human-readable formula string.
 * e.g. "3 workers × ₱800/day × 22 days = ₱52,800"
 */
export function laborCostLabel(dailyRate, headcount, workingDays, currency = 'PHP') {
    const fmt = v => new Intl.NumberFormat('en-PH', {
        style: 'currency', currency, minimumFractionDigits: 0
    }).format(v)
    const total = calcLaborCost({ dailyRate, headcount, workingDays })
    return `${headcount} worker${headcount !== 1 ? 's' : ''} × ${fmt(dailyRate)}/day × ${workingDays} days = ${fmt(total)}`
}

/**
 * List all excluded days with reasons — useful for the expanded row detail.
 */
export function listExcludedDays(start, end, customHolidays = []) {
    if (!start || !end) return []
    const s = new Date(start); s.setHours(0, 0, 0, 0)
    const e = new Date(end); e.setHours(0, 0, 0, 0)
    const excluded = []
    const cur = new Date(s)

    while (cur <= e) {
        const iso = toISODate(cur)
        if (isWeekend(cur)) {
            excluded.push({ date: iso, reason: 'Weekend' })
        } else if (isCustomHoliday(cur, customHolidays)) {
            const ch = customHolidays.find(h => h.date === iso)
            excluded.push({ date: iso, reason: ch?.name || 'Custom holiday' })
        } else if (isPHHoliday(cur)) {
            excluded.push({ date: iso, reason: 'PH public holiday' })
        }
        cur.setDate(cur.getDate() + 1)
    }
    return excluded
}

// ── OPEX billing type helpers ─────────────────────────

export const BILLING_TYPES = [
    { value: 'per_use', label: 'Per use', hint: 'One-time cost' },
    { value: 'per_day', label: 'Per day', hint: 'Daily recurring' },
    { value: 'per_week', label: 'Per week', hint: 'Weekly recurring' },
    { value: 'per_month', label: 'Per month', hint: 'Monthly recurring' },
]

/**
 * Compute the duration multiplier for a timely OPEX item.
 * Uses working days (excludes weekends + PH holidays + custom holidays).
 *
 * @param {string} billingType - 'per_use' | 'per_day' | 'per_week' | 'per_month'
 * @param {string} start       - project or item start date
 * @param {string} end         - project or item end date
 * @param {Array}  customHolidays
 * @returns {number} multiplier (1 for per_use)
 */
export function resolveOpexDuration(billingType, start, end, customHolidays = []) {
    if (!billingType || billingType === 'per_use') return 1
    if (!start || !end) return 1

    const days = countWorkingDays(start, end, customHolidays)

    switch (billingType) {
        case 'per_day': return days
        case 'per_week': return Math.ceil(days / 5)   // 5 working days per week
        case 'per_month': return Math.ceil(days / 22)  // ~22 working days per month
        default: return 1
    }
}

/**
 * Compute the total cost for an OPEX line item.
 * Per-use: unit_cost × qty
 * Timely:  unit_cost × qty × duration
 */
export function resolveOpexCost(item, projectStart, projectEnd, customHolidays = []) {
    const cost = parseFloat(item.unit_cost_snapshot || item.unit_cost) || 0
    const qty = parseInt(item.quantity) || 1
    const billingType = item.billing_type || 'per_use'
    const start = item.labor_start_date || projectStart
    const end = item.labor_end_date || projectEnd
    const duration = resolveOpexDuration(billingType, start, end, customHolidays)
    return cost * qty * duration
}

/**
 * Human-readable formula for an OPEX item.
 * e.g. "₱5,000/week × 2 units × 6 weeks = ₱60,000"
 */
export function opexCostLabel(unitCost, qty, billingType, duration, currency = 'PHP') {
    const fmt = v => new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v)
    const total = unitCost * qty * duration
    const unitLabel = {
        per_use: '',
        per_day: '/day',
        per_week: '/week',
        per_month: '/month',
    }[billingType] || ''

    if (billingType === 'per_use') {
        return qty > 1
            ? `${fmt(unitCost)} × ${qty} = ${fmt(total)}`
            : `${fmt(unitCost)}`
    }
    return `${fmt(unitCost)}${unitLabel} × ${qty} unit${qty !== 1 ? 's' : ''} × ${duration} ${billingType.replace('per_', '')}${duration !== 1 ? 's' : ''} = ${fmt(total)}`
}

// ── Smart unit presets ─────────────────────────────────
// These drive both the display unit and the billing_type calculation.
export const UNIT_PRESETS = [
    { label: 'per use', value: 'per use', billing_type: 'per_use' },
    { label: 'per day', value: 'per day', billing_type: 'per_day' },
    { label: 'per week', value: 'per week', billing_type: 'per_week' },
    { label: 'per month', value: 'per month', billing_type: 'per_month' },
]

// Derive billing_type from a unit string
export function billingTypeFromUnit(unit) {
    const preset = UNIT_PRESETS.find(p => p.value === unit)
    return preset ? preset.billing_type : 'per_use'
}