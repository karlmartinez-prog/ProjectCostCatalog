export const formatPeso = (amount) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)

export const formatCompact = (amount) =>
    new Intl.NumberFormat('en-PH', { notation: 'compact', currency: 'PHP', style: 'currency' }).format(amount)