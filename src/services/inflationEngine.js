// Compound inflation: cost * (1 + rate)^years
export function adjustForInflation(baseCost, annualRatePercent, years) {
    const rate = annualRatePercent / 100
    return baseCost * Math.pow(1 + rate, years)
}

// Get adjusted cost from today to a target year
export function projectCost(baseCost, ratePercent, fromYear, toYear) {
    const years = toYear - fromYear
    if (years <= 0) return baseCost
    return adjustForInflation(baseCost, ratePercent, years)
}

// Apply per-category rates to a list of project resources
export function estimateInflatedTotal(projectResources, inflationRates, targetYear) {
    const currentYear = new Date().getFullYear()
    return projectResources.reduce((total, item) => {
        const rate = inflationRates.find(r => r.category_id === item.resource.category_id)
        const adjustedCost = rate
            ? projectCost(item.unit_cost_snapshot, rate.rate_percent, currentYear, targetYear)
            : item.unit_cost_snapshot
        return total + adjustedCost * item.quantity
    }, 0)
}