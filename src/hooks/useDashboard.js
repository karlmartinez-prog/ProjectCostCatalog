import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useDashboard() {
    const [stats, setStats] = useState(null)
    const [recentActivity, setRecentActivity] = useState([])
    const [capexOpexData, setCapexOpexData] = useState([])
    const [monthlyCostData, setMonthlyCostData] = useState([])
    const [projectCostData, setProjectCostData] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function fetchAll() {
            setLoading(true)
            setError(null)

            try {
                const [
                    { data: projects, error: e1 },
                    { data: resources, error: e2 },
                    { data: suppliers, error: e3 },
                    { data: lineItems, error: e4 },
                    { data: recentRes, error: e5 },
                    { data: recentProj, error: e6 },
                ] = await Promise.all([
                    supabase.from('projects').select('id, name, status, total_cost, currency, created_at'),
                    supabase.from('resources').select('id, name, status, unit_cost, quantity, created_at'),
                    supabase.from('suppliers').select('id, status'),
                    supabase.from('project_resources').select('capex_opex, total_cost, created_at'),
                    supabase
                        .from('resources')
                        .select('id, name, unit_cost, currency, status, created_at, categories(name, type), suppliers(name)')
                        .order('created_at', { ascending: false })
                        .limit(5),
                    supabase
                        .from('projects')
                        .select('id, name, status, total_cost, currency, created_at')
                        .order('created_at', { ascending: false })
                        .limit(5),
                ])

                if (e1 || e2 || e3 || e4 || e5 || e6) {
                    throw new Error([e1, e2, e3, e4, e5, e6].find(e => e)?.message)
                }

                // ── KPI Stats ──────────────────────────────────
                const totalCapex = (lineItems || [])
                    .filter(i => i.capex_opex === 'CAPEX')
                    .reduce((s, i) => s + (i.total_cost || 0), 0)

                const totalOpex = (lineItems || [])
                    .filter(i => i.capex_opex === 'OPEX')
                    .reduce((s, i) => s + (i.total_cost || 0), 0)

                const currentYear = new Date().getFullYear()
                const capexThisYear = (lineItems || [])
                    .filter(i => i.capex_opex === 'CAPEX' && new Date(i.created_at).getFullYear() === currentYear)
                    .reduce((s, i) => s + (i.total_cost || 0), 0)

                const opexThisYear = (lineItems || [])
                    .filter(i => i.capex_opex === 'OPEX' && new Date(i.created_at).getFullYear() === currentYear)
                    .reduce((s, i) => s + (i.total_cost || 0), 0)

                const activeProjects = (projects || []).filter(p => p.status === 'ongoing').length
                const activeSuppliers = (suppliers || []).filter(s => s.status === 'active').length
                const activeResources = (resources || []).filter(r => r.status === 'active').length
                const totalProjectCost = (projects || []).reduce((s, p) => s + (p.total_cost || 0), 0)

                setStats({
                    totalProjects: (projects || []).length,
                    activeProjects,
                    totalResources: (resources || []).length,
                    activeResources,
                    totalSuppliers: (suppliers || []).length,
                    activeSuppliers,
                    totalCapex,
                    totalOpex,
                    capexThisYear,
                    opexThisYear,
                    totalProjectCost,
                })

                // ── CAPEX vs OPEX chart ─────────────────────────
                const untagged = (lineItems || [])
                    .filter(i => !i.capex_opex)
                    .reduce((s, i) => s + (i.total_cost || 0), 0)

                setCapexOpexData([
                    { name: 'CAPEX', value: Math.round(totalCapex), fill: '#2563eb' },
                    { name: 'OPEX', value: Math.round(totalOpex), fill: '#8b5cf6' },
                    ...(untagged > 0 ? [{ name: 'Untagged', value: Math.round(untagged), fill: '#e5e2d9' }] : []),
                ].filter(d => d.value > 0))

                // ── Monthly cost trend (last 8 months) ─────────
                const now = new Date()
                const months = Array.from({ length: 8 }, (_, i) => {
                    const d = new Date(now.getFullYear(), now.getMonth() - (7 - i), 1)
                    return {
                        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                        label: d.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' }),
                        capex: 0,
                        opex: 0,
                    }
                })

                for (const item of lineItems || []) {
                    const key = item.created_at?.slice(0, 7)
                    const m = months.find(m => m.key === key)
                    if (!m) continue
                    if (item.capex_opex === 'CAPEX') m.capex += item.total_cost || 0
                    else if (item.capex_opex === 'OPEX') m.opex += item.total_cost || 0
                }

                setMonthlyCostData(months.map(m => ({
                    ...m,
                    capex: Math.round(m.capex),
                    opex: Math.round(m.opex),
                })))

                // ── Project cost comparison (top 8 by cost) ─────
                setProjectCostData(
                    (projects || [])
                        .filter(p => p.total_cost > 0)
                        .sort((a, b) => b.total_cost - a.total_cost)
                        .slice(0, 8)
                        .map(p => ({
                            name: p.name.length > 22 ? p.name.slice(0, 22) + '…' : p.name,
                            cost: Math.round(p.total_cost),
                            status: p.status,
                        }))
                )

                // ── Recent activity ─────────────────────────────
                const activity = [
                    ...(recentRes || []).map(r => ({
                        id: r.id,
                        type: 'resource',
                        name: r.name,
                        meta: r.categories?.name || 'Resource',
                        cost: r.unit_cost,
                        currency: r.currency,
                        status: r.status,
                        createdAt: r.created_at,
                    })),
                    ...(recentProj || []).map(p => ({
                        id: p.id,
                        type: 'project',
                        name: p.name,
                        meta: p.status,
                        cost: p.total_cost,
                        currency: p.currency,
                        status: p.status,
                        createdAt: p.created_at,
                    })),
                ]
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 8)

                setRecentActivity(activity)
            } catch (err) {
                setError(err.message)
            }

            setLoading(false)
        }

        fetchAll()
    }, [])

    return { stats, recentActivity, capexOpexData, monthlyCostData, projectCostData, loading, error }
}