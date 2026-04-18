const DEFAULT_RATE = 6.0  // fallback when no category rate is set

/**
 * Compound inflation: cost × (1 + rate/100)^years
 */
export function adjustForInflation(baseCost, annualRatePercent, years) {
    if (!years || years <= 0) return baseCost
    return baseCost * Math.pow(1 + annualRatePercent / 100, years)
}

/**
 * Project a cost from a base year to a target year.
 */
export function projectCost(baseCost, ratePercent, fromYear, toYear) {
    return adjustForInflation(baseCost, ratePercent, toYear - fromYear)
}

/**
 * Resolve the best available rate for a category.
 * Uses the rate for the current year if set, otherwise the closest year,
 * otherwise the default.
 */
export function resolveRate(categoryId, inflationRates, fallback = DEFAULT_RATE) {
    if (!inflationRates?.length) return fallback
    const currentYear = new Date().getFullYear()
    const catRates = inflationRates.filter(r => r.category_id === categoryId)
    if (!catRates.length) return fallback
    // prefer exact year match, else closest
    const exact = catRates.find(r => r.year === currentYear)
    if (exact) return exact.rate_percent
    const sorted = [...catRates].sort((a, b) => Math.abs(a.year - currentYear) - Math.abs(b.year - currentYear))
    return sorted[0].rate_percent
}

/**
 * Calculate the inflation-adjusted price for a single resource.
 * procuredYear: the year the resource was procured (from procured_at)
 * targetYear:   the year to adjust to (defaults to current year)
 */
export function adjustedResourceCost(resource, inflationRates, targetYear) {
    const currentYear = new Date().getFullYear()
    const to = targetYear ?? currentYear
    const from = resource.procured_at
        ? new Date(resource.procured_at).getFullYear()
        : currentYear

    if (from >= to) return resource.unit_cost  // already current or future

    const rate = resolveRate(resource.categories?.id, inflationRates)
    return adjustForInflation(resource.unit_cost, rate, to - from)
}

/**
 * Apply per-category inflation rates to a list of project line items.
 */
export function estimateInflatedTotal(lineItems, inflationRates, targetYear) {
    const currentYear = new Date().getFullYear()
    return lineItems.reduce((total, item) => {
        const categoryId = item.resources?.categories?.id
        const rate = resolveRate(categoryId, inflationRates)
        const from = item.resources?.procured_at
            ? new Date(item.resources.procured_at).getFullYear()
            : currentYear
        const to = targetYear ?? currentYear
        const adjusted = from < to
            ? adjustForInflation(item.unit_cost_snapshot, rate, to - from)
            : item.unit_cost_snapshot
        return total + adjusted * item.quantity
    }, 0)
}

/**
 * Get a simple default-rate inflated cost.
 */
export function getDefaultInflated(baseCost, years, defaultRate = DEFAULT_RATE) {
    return adjustForInflation(baseCost, defaultRate, years)
}