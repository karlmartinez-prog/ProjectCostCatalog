import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// PSA CPI preset suggestions by category keyword
const PRESET_RATES = {
    'civil': 6.8,
    'construction': 6.8,
    'electrical': 5.9,
    'mechanical': 5.5,
    'labor': 7.2,
    'manpower': 7.2,
    'material': 6.1,
    'equipment': 5.2,
    'software': 3.1,
    'fuel': 8.4,
    'maintenance': 5.8,
    'default': 6.0,
}

export function getPresetRate(categoryName = '') {
    const lower = categoryName.toLowerCase()
    for (const [key, rate] of Object.entries(PRESET_RATES)) {
        if (key !== 'default' && lower.includes(key)) return rate
    }
    return PRESET_RATES.default
}

export function useInsights(quarterCount = 4) {
    const [costHistory, setCostHistory] = useState([])
    const [categories, setCategories] = useState([])
    const [inflationRates, setInflationRates] = useState([])
    const [projects, setProjects] = useState([])
    const [lineItems, setLineItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function fetch() {
            setLoading(true)
            setError(null)
            try {
                const [
                    { data: hist, error: e1 },
                    { data: cats, error: e2 },
                    { data: rates, error: e3 },
                    { data: projs, error: e4 },
                    { data: items, error: e5 },
                ] = await Promise.all([
                    supabase
                        .from('cost_history')
                        .select('*, resources(id, name, categories(id, name, type))')
                        .order('effective_date', { ascending: true }),
                    supabase.from('categories').select('*').order('name'),
                    supabase.from('inflation_rates').select('*'),
                    supabase
                        .from('projects')
                        .select('id, name, status, total_cost, currency, start_date, end_date, created_at')
                        .order('created_at', { ascending: false }),
                    supabase
                        .from('project_resources')
                        .select('*, resources(id, name, categories(id, name, type))')
                        .order('created_at', { ascending: true }),])

                if (e1 || e2 || e3 || e4 || e5)
                    throw new Error([e1, e2, e3, e4, e5].find(e => e)?.message)

                setCostHistory(hist || [])
                setCategories(cats || [])
                setInflationRates(rates || [])
                setProjects(projs || [])
                setLineItems(items || [])
            } catch (err) {
                setError(err.message)
            }
            setLoading(false)
        }
        fetch()
    }, [])

    // ── Build quarterly spend data ────────────────────
    const quarterlyData = buildQuarterlyData(lineItems, quarterCount)

    // ── Cost per category ─────────────────────────────
    const categorySpend = buildCategorySpend(lineItems)

    return {
        costHistory, categories, inflationRates,
        projects, lineItems, quarterlyData, categorySpend,
        loading, error,
    }
}

export function useInflationRates() {
    const [rates, setRates] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        supabase.from('inflation_rates').select('*, categories(id, name)')
            .then(({ data }) => { setRates(data || []); setLoading(false) })
    }, [])

    async function upsertRate(categoryId, year, ratePercent, region = 'PH') {
        const existing = rates.find(r => r.category_id === categoryId && r.year === year)
        if (existing) {
            const { data } = await supabase
                .from('inflation_rates')
                .update({ rate_percent: ratePercent })
                .eq('id', existing.id)
                .select('*, categories(id, name)')
                .maybeSingle()
            if (data) setRates(prev => prev.map(r => r.id === existing.id ? data : r))
        } else {
            const { data } = await supabase
                .from('inflation_rates')
                .insert([{ category_id: categoryId, year, rate_percent: ratePercent, region }])
                .select('*, categories(id, name)')
                .maybeSingle()
            if (data) setRates(prev => [...prev, data])
        }
    }

    async function deleteRate(id) {
        await supabase.from('inflation_rates').delete().eq('id', id)
        setRates(prev => prev.filter(r => r.id !== id))
    }

    return { rates, loading, upsertRate, deleteRate }
}

// ── Helpers ───────────────────────────────────────────
function normaliseItems(lineItems) {
    return (lineItems || []).map(i => ({
        ...i,
        capex_opex: i.capex_opex || i.resources?.categories?.type || null,
    }))
}

function buildQuarterlyData(lineItems, count) {
    const items = normaliseItems(lineItems)
    const now = new Date()
    const quarters = []

    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1)
        const qNum = Math.floor(d.getMonth() / 3) + 1
        const label = `Q${qNum} '${String(d.getFullYear()).slice(2)}`
        const qStart = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
        const qEnd = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0)
        quarters.push({ label, qStart, qEnd, capex: 0, opex: 0, total: 0 })
    }

    for (const item of items) {
        const date = new Date(item.created_at)
        const q = quarters.find(q => date >= q.qStart && date <= q.qEnd)
        if (!q) continue
        const cost = item.total_cost || 0
        if (item.capex_opex === 'CAPEX') q.capex += cost
        else if (item.capex_opex === 'OPEX') q.opex += cost
        q.total += cost
    }

    return quarters.map(({ label, capex, opex, total }) => ({
        label,
        capex: Math.round(capex),
        opex: Math.round(opex),
        total: Math.round(total),
    }))
}

function buildCategorySpend(lineItems) {
    const items = normaliseItems(lineItems)
    const map = {}
    for (const item of items) {
        const cat = item.resources?.categories
        const key = cat?.id || 'untagged'
        const name = cat?.name || 'Untagged'
        const type = cat?.type || '—'
        if (!map[key]) map[key] = { name, type, total: 0 }
        map[key].total += item.total_cost || 0
    }
    return Object.values(map)
        .sort((a, b) => b.total - a.total)
        .map(d => ({ ...d, total: Math.round(d.total) }))
}