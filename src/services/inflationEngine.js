/**
 * inflationEngine.js
 *
 * Proper year-over-year compounding.
 *
 * Instead of picking a single rate and applying it across all years,
 * we walk year-by-year, applying each year's actual rate.
 *
 * Example: cost of ₱100 from 2022 → 2025 with rates:
 *   2022: 6%, 2023: 8%, 2024: 5%
 *   ₱100 × 1.06 × 1.08 × 1.05 = ₱120.07
 *
 * If a year has no rate set, we fall back to:
 *   1. The most recent known rate for that category
 *   2. The global DEFAULT_RATE (6%)
 */

const DEFAULT_RATE = 6.0

// ── Core helpers ──────────────────────────────────────

/**
 * Simple single-rate compound: cost × (1 + rate/100)^years
 * Still used by the EstimatorModal (user picks one flat rate).
 */
export function adjustForInflation(baseCost, annualRatePercent, years) {
    if (!years || years <= 0) return baseCost
    return baseCost * Math.pow(1 + annualRatePercent / 100, years)
}

/**
 * Get the rate for a specific category in a specific year.
 * Falls back to: most recent past rate for that category → DEFAULT_RATE.
 */
export function getRateForYear(categoryId, year, inflationRates, fallback = DEFAULT_RATE) {
    if (!inflationRates?.length) return fallback

    const catRates = inflationRates.filter(r => r.category_id === categoryId)
    if (!catRates.length) return fallback

    // Exact year match
    const exact = catRates.find(r => r.year === year)
    if (exact) return exact.rate_percent

    // Most recent rate before this year (carry forward last known rate)
    const past = catRates
        .filter(r => r.year < year)
        .sort((a, b) => b.year - a.year)
    if (past.length) return past[0].rate_percent

    // Closest available year (future rate, if no past data)
    const sorted = [...catRates].sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))
    return sorted[0].rate_percent
}

/**
 * Year-over-year compound: walks fromYear → toYear, applying
 * the correct rate for each individual year.
 *
 * e.g. from=2022, to=2025 applies rates for 2022, 2023, 2024
 * (the rate for year Y is applied to get from Y → Y+1)
 */
export function compoundYoY(baseCost, categoryId, fromYear, toYear, inflationRates) {
    if (fromYear >= toYear) return baseCost

    let cost = baseCost
    for (let year = fromYear; year < toYear; year++) {
        const rate = getRateForYear(categoryId, year, inflationRates)
        cost = cost * (1 + rate / 100)
    }
    return cost
}

// ── resolveRate kept for backwards compat ─────────────
// Returns a single representative rate (used in labels/display).
// For actual calculations, use compoundYoY instead.
export function resolveRate(categoryId, inflationRates, fallback = DEFAULT_RATE) {
    return getRateForYear(categoryId, new Date().getFullYear(), inflationRates, fallback)
}

// ── Public calculation functions ──────────────────────

/**
 * Inflation-adjusted cost for a single resource.
 * Uses year-over-year compounding from procured_at year → targetYear.
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

/**
 * Inflation-adjusted cost for a single project line item.
 * Falls back to projectBaseYear when the resource has no procured_at.
 */
export function adjustedLineItemCost(item, inflationRates, targetYear, projectBaseYear) {
    const currentYear = new Date().getFullYear()
    const to = targetYear ?? currentYear
    const from = item.resources?.procured_at
        ? new Date(item.resources.procured_at).getFullYear()
        : (projectBaseYear ?? currentYear)

    if (from >= to) return item.unit_cost_snapshot

    return compoundYoY(
        item.unit_cost_snapshot,
        item.resources?.categories?.id,
        from,
        to,
        inflationRates
    )
}

/**
 * Inflation-adjusted total for a whole project (catalog card level).
 * Uses project start year as the baseline, compounds to targetYear.
 */
export function adjustedProjectCost(project, inflationRates, targetYear) {
    const currentYear = new Date().getFullYear()
    const to = targetYear ?? currentYear
    const from = project.start_date
        ? new Date(project.start_date).getFullYear()
        : project.created_at
            ? new Date(project.created_at).getFullYear()
            : currentYear

    if (from >= to) return project.total_cost

    // At the project card level we don't have per-line category info,
    // so we use the average of all stored rates as the representative rate,
    // then do a single compound pass (best approximation without line items).
    if (!inflationRates?.length) {
        return adjustForInflation(project.total_cost, DEFAULT_RATE, to - from)
    }

    let cost = project.total_cost
    for (let year = from; year < to; year++) {
        const ratesForYear = inflationRates.filter(r => r.year === year)
        const rate = ratesForYear.length
            ? ratesForYear.reduce((s, r) => s + r.rate_percent, 0) / ratesForYear.length
            : DEFAULT_RATE
        cost = cost * (1 + rate / 100)
    }
    return cost
}

/**
 * Estimate inflated total for a list of project line items.
 * Used by the AI Estimator and Insights hooks.
 */
export function estimateInflatedTotal(lineItems, inflationRates, targetYear) {
    const currentYear = new Date().getFullYear()
    return lineItems.reduce((total, item) => {
        const adjusted = adjustedLineItemCost(item, inflationRates, targetYear ?? currentYear, currentYear)
        return total + adjusted * item.quantity
    }, 0)
}

/**
 * Legacy single-rate project cost — kept for backwards compat.
 */
export function projectCost(baseCost, ratePercent, fromYear, toYear) {
    return adjustForInflation(baseCost, ratePercent, toYear - fromYear)
}

/**
 * Simple default-rate inflated cost.
 */
export function getDefaultInflated(baseCost, years, defaultRate = DEFAULT_RATE) {
    return adjustForInflation(baseCost, defaultRate, years)
}