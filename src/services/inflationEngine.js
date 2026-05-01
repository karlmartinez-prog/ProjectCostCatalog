/**
 * inflationEngine.js
 *
 * Year-over-year COMPOUNDING inflation calculator.
 *
 * Base year is ALWAYS the project's start year — never procured_at or any
 * resource-level date. Rates are looked up per resource category from the
 * inflation_rates Supabase table.
 *
 * How compounding works:
 *
 *   Base year 2023, target 2026, Civil Works rates:
 *     2024: 4.8%,  2025: 5.1%,  2026: 5.4%
 *
 *   ₱1,000 × 1.048 × 1.051 × 1.054 = ₱1,160.93
 *
 *   The rate for year Y is applied AT THE END of year Y, so we walk
 *   from (baseYear + 1) up to and including toYear.
 *
 * Fallback order when a rate is missing for a category + year:
 *   1. Most recent past rate for that category (carry-forward)
 *   2. Nearest available rate for that category
 *   3. Global DEFAULT_RATE (6.0%)
 */

const DEFAULT_RATE = 6.0

// ─────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────

/**
 * Read the numeric rate value from a rate row.
 * Handles both the raw column (rate_percent) and the normalized alias (rate)
 * that useInsights adds via normalizeRate().
 */
function readRate(rateRow) {
    return rateRow.rate ?? rateRow.rate_percent ?? DEFAULT_RATE
}

/**
 * Get the inflation rate (%) for a specific category in a specific year.
 *
 * Fallback chain:
 *  1. Exact category + year match
 *  2. Most recent past rate for that category (carry-forward)
 *  3. Nearest available rate for that category
 *  4. DEFAULT_RATE
 */
export function getRateForYear(categoryId, year, inflationRates, fallback = DEFAULT_RATE) {
    if (!inflationRates?.length || !categoryId) return fallback

    const catRates = inflationRates.filter(r => r.category_id === categoryId)
    if (!catRates.length) return fallback

    // 1. Exact match
    const exact = catRates.find(r => r.year === year)
    if (exact) return readRate(exact)

    // 2. Most recent past rate (carry-forward is most realistic)
    const past = catRates
        .filter(r => r.year < year)
        .sort((a, b) => b.year - a.year)
    if (past.length) return readRate(past[0])

    // 3. Nearest available (future rate, no past data at all)
    const sorted = [...catRates].sort(
        (a, b) => Math.abs(a.year - year) - Math.abs(b.year - year)
    )
    return readRate(sorted[0])
}

/**
 * Compound a cost from baseYear to toYear, applying each year's rate
 * at the END of that year (i.e. rates for baseYear+1 … toYear).
 *
 *   baseYear=2023, toYear=2026 → applies rates for 2024, 2025, 2026
 */
export function compoundYoY(baseCost, categoryId, baseYear, toYear, inflationRates) {
    if (!baseCost || baseYear >= toYear) return baseCost

    let cost = baseCost
    for (let year = baseYear + 1; year <= toYear; year++) {
        const rate = getRateForYear(categoryId, year, inflationRates)
        cost = cost * (1 + rate / 100)
    }
    return cost
}

// ─────────────────────────────────────────────────────
// Core line-item calculation (the source of truth)
// ─────────────────────────────────────────────────────

/**
 * Inflation-adjusted unit cost for a single project_resources line item.
 *
 * Base year is ALWAYS projectBaseYear (project start year).
 * Category is resolved from item.resources.categories.id.
 *
 * @param {object} item            - project_resources row (resources + categories joined)
 * @param {Array}  inflationRates  - Full rates array from Supabase
 * @param {number} targetYear      - Year to inflate to (usually current year)
 * @param {number} projectBaseYear - Project start year (the base for compounding)
 * @returns {number} Adjusted unit cost
 */
export function adjustedLineItemCost(item, inflationRates, targetYear, projectBaseYear) {
    const baseCost = item.unit_cost_snapshot ?? item.unit_cost ?? 0
    if (!baseCost || projectBaseYear >= targetYear) return baseCost

    const categoryId = item.resources?.categories?.id ?? null

    return compoundYoY(baseCost, categoryId, projectBaseYear, targetYear, inflationRates)
}

/**
 * Compute the display total for a single line item the same way
 * ProjectDetail does — handles time-based units (per day/week/month).
 *
 * This is a mirror of ProjectDetail's resolveDurationFromUnit + displayTotal
 * logic so the catalog and detail views always agree.
 */
function resolveDisplayTotal(item, adjustedUnitCost) {
    const unit = (item.resources?.unit || item.unit || '').toLowerCase().trim()
    const workingDays = item.working_days ?? 0

    let duration = null
    if (unit === 'per day' || unit === 'day') duration = workingDays
    else if (unit === 'per week' || unit === 'week') duration = Math.ceil(workingDays / 5)
    else if (unit === 'per month' || unit === 'month') duration = Math.ceil(workingDays / 22)

    return duration !== null
        ? adjustedUnitCost * (item.quantity ?? 1) * duration
        : adjustedUnitCost * (item.quantity ?? 1)
}

// ─────────────────────────────────────────────────────
// Project-level totals
// ─────────────────────────────────────────────────────

/**
 * Inflation-adjusted grand total for a project.
 *
 * When lineItems are provided (ProjectDetail has them, and we now also
 * fetch them for the catalog), this does EXACT per-line-item, per-category
 * compounding — identical math to what ProjectDetail renders in its table.
 *
 * When lineItems are NOT provided (legacy fallback), it falls back to
 * averaging all category rates per year across the whole total_cost.
 *
 * Passing lineItems is the ONLY way the catalog card and the detail view
 * will ever show the same number.
 *
 * @param {object} project        - Project row from Supabase
 * @param {Array}  inflationRates - Full rates array from Supabase
 * @param {number} toYear         - Target year
 * @param {Array}  [lineItems]    - project_resources rows (resources + categories joined)
 * @returns {number} Inflation-adjusted total cost
 */
export function adjustedProjectCost(project, inflationRates, toYear, lineItems) {
    const fromYear = project.start_date
        ? new Date(project.start_date).getFullYear()
        : project.created_at
            ? new Date(project.created_at).getFullYear()
            : new Date().getFullYear()

    // ── Exact path: line items available ──────────────
    if (lineItems?.length) {
        return lineItems.reduce((total, item) => {
            const adjUnitCost = adjustedLineItemCost(item, inflationRates, toYear, fromYear)
            return total + resolveDisplayTotal(item, adjUnitCost)
        }, 0)
    }

    // ── Fallback path: no line items (e.g. legacy callers) ──
    const baseCost = project.total_cost ?? 0
    if (!baseCost || fromYear >= toYear) return baseCost

    if (!inflationRates?.length) {
        let cost = baseCost
        for (let year = fromYear + 1; year <= toYear; year++) {
            cost = cost * (1 + DEFAULT_RATE / 100)
        }
        return cost
    }

    let cost = baseCost
    for (let year = fromYear + 1; year <= toYear; year++) {
        const ratesForYear = inflationRates.filter(r => r.year === year)
        const avgRate = ratesForYear.length
            ? ratesForYear.reduce((sum, r) => sum + readRate(r), 0) / ratesForYear.length
            : DEFAULT_RATE
        cost = cost * (1 + avgRate / 100)
    }
    return cost
}

// ─────────────────────────────────────────────────────
// Resource catalog (standalone, no project context)
// ─────────────────────────────────────────────────────

/**
 * Inflation-adjusted cost for a standalone resource record.
 * procured_at is the correct base here — there is no project context.
 */
export function adjustedResourceCost(resource, inflationRates, targetYear) {
    const currentYear = new Date().getFullYear()
    const to = targetYear ?? currentYear
    const from = resource.procured_at
        ? new Date(resource.procured_at).getFullYear()
        : currentYear

    if (from >= to) return resource.unit_cost

    return compoundYoY(
        resource.unit_cost,
        resource.categories?.id,
        from,
        to,
        inflationRates
    )
}

// ─────────────────────────────────────────────────────
// Misc / legacy
// ─────────────────────────────────────────────────────

/**
 * Simple fixed-rate compound — used by EstimatorModal.
 */
export function adjustForInflation(baseCost, annualRatePercent, years) {
    if (!years || years <= 0) return baseCost
    return baseCost * Math.pow(1 + annualRatePercent / 100, years)
}

/**
 * Estimate inflated total for a list of line items.
 * Used by the AI Estimator and Insights hooks.
 */
export function estimateInflatedTotal(lineItems, inflationRates, targetYear) {
    const currentYear = new Date().getFullYear()
    const to = targetYear ?? currentYear
    return lineItems.reduce((total, item) => {
        const adjusted = adjustedLineItemCost(item, inflationRates, to, currentYear)
        return total + adjusted * (item.quantity ?? 1)
    }, 0)
}

/**
 * Single representative rate for display labels only.
 */
export function resolveRate(categoryId, inflationRates, fallback = DEFAULT_RATE) {
    return getRateForYear(categoryId, new Date().getFullYear(), inflationRates, fallback)
}

export function projectCost(baseCost, ratePercent, fromYear, toYear) {
    return adjustForInflation(baseCost, ratePercent, toYear - fromYear)
}

export function getDefaultInflated(baseCost, years, defaultRate = DEFAULT_RATE) {
    return adjustForInflation(baseCost, defaultRate, years)
}