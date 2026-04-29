import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

// ── Single source of truth for duration multiplier ───────
// Matches the same logic in ProjectModal.jsx and ProjectDetail.jsx.
// unit drives everything — works for both labor and non-labor.
function resolveDurationFromUnit(unit, workingDays) {
    const u = (unit || '').toLowerCase().trim()
    if (u === 'per day' || u === 'day') return workingDays
    if (u === 'per week' || u === 'week') return Math.ceil(workingDays / 5)
    if (u === 'per month' || u === 'month') return Math.ceil(workingDays / 22)
    return null // flat item — no time multiplier
}

// ── Compute one line item's total ────────────────────────
function lineItemTotal(item) {
    const cost = parseFloat(item.unit_cost_snapshot) || 0
    const qty = parseInt(item.quantity) || 1

    // Read unit from the resource join first, then fall back to item-level fields
    const unit = (item.resources?.unit || item._unit || item.unit || '').toLowerCase().trim()
    const workingDays = item.working_days || 0

    const duration = resolveDurationFromUnit(unit, workingDays)
    return duration !== null ? cost * qty * duration : cost * qty
}

// ── useProjects ────────────────────────────────────────
export function useProjects(filters = {}) {
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetchProjects = useCallback(async () => {
        setLoading(true)
        setError(null)
        let query = supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false })
        if (filters.status) query = query.eq('status', filters.status)
        if (filters.search) query = query.ilike('name', `%${filters.search}%`)
        const { data, error } = await query
        if (error) setError(error.message)
        else setProjects(data || [])
        setLoading(false)
    }, [filters.status, filters.search])

    useEffect(() => { fetchProjects() }, [fetchProjects])

    async function createProject(projectPayload, lineItems) {
        // Compute correct total before inserting
        const items = lineItems || []
        const total = items.reduce((sum, i) => sum + lineItemTotal(i), 0)

        const { data: project, error: pErr } = await supabase
            .from('projects')
            .insert([{ ...projectPayload, total_cost: total }])
            .select('*')
            .maybeSingle()
        if (pErr) throw pErr
        if (!project) throw new Error('Failed to create project — check RLS policies.')

        if (items.length > 0) {
            const rows = items.map(item => ({
                project_id: project.id,
                resource_id: item.resource_id || null,
                resource_type: item._resource_type || item.resource_type || 'Material',
                custom_name: item._name && !item.resource_id ? item._name : null,
                unit_cost_snapshot: parseFloat(item.unit_cost_snapshot) || 0,
                quantity: parseInt(item.quantity) || 1,
                capex_opex: item.capex_opex || null,
                billing_type: item.billing_type || 'per_use',
                working_days: item.working_days || null,
                labor_start_date: item.labor_start_date || null,
                labor_end_date: item.labor_end_date || null,
            }))
            const { error: liErr } = await supabase.from('project_resources').insert(rows)
            if (liErr) throw liErr
        }

        const final = { ...project, total_cost: total }
        setProjects(prev => [final, ...prev])
        return final
    }

    async function updateProject(id, projectPayload, lineItems) {
        const items = lineItems || []
        const total = items.reduce((sum, i) => sum + lineItemTotal(i), 0)

        const { data: project, error: pErr } = await supabase
            .from('projects')
            .update({ ...projectPayload, total_cost: total })
            .eq('id', id)
            .select('*')
            .maybeSingle()
        if (pErr) throw pErr
        if (!project) throw new Error('Update failed — check RLS policies.')

        if (lineItems !== undefined) {
            await supabase.from('project_resources').delete().eq('project_id', id)

            if (items.length > 0) {
                const rows = items.map(item => ({
                    project_id: id,
                    resource_id: item.resource_id || null,
                    resource_type: item._resource_type || item.resource_type || 'Material',
                    custom_name: item._name && !item.resource_id ? item._name : null,
                    unit_cost_snapshot: parseFloat(item.unit_cost_snapshot) || 0,
                    quantity: parseInt(item.quantity) || 1,
                    capex_opex: item.capex_opex || null,
                    billing_type: item.billing_type || 'per_use',
                    working_days: item.working_days || null,
                    labor_start_date: item.labor_start_date || null,
                    labor_end_date: item.labor_end_date || null,
                }))
                const { error: liErr } = await supabase.from('project_resources').insert(rows)
                if (liErr) throw liErr
            }

            project.total_cost = total
        }

        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...project } : p))
        return project
    }

    async function deleteProject(id) {
        await supabase.from('project_resources').delete().eq('project_id', id)
        const { error } = await supabase.from('projects').delete().eq('id', id)
        if (error) throw error
        setProjects(prev => prev.filter(p => p.id !== id))
    }

    return { projects, loading, error, createProject, updateProject, deleteProject, refetch: fetchProjects }
}

// ── useProjectDetail ───────────────────────────────────
export function useProjectDetail(projectId) {
    const [project, setProject] = useState(null)
    const [lineItems, setLineItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!projectId) return
        setLoading(true)
        setError(null)

        Promise.all([
            supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single(),
            supabase
                .from('project_resources')
                .select(`
                    *,
                    resources(
                        id, name, image_url, unit, currency,
                        resource_type, trade, procured_at,
                        categories(id, name, type)
                    )
                `)
                .eq('project_id', projectId)
                .order('created_at'),
        ]).then(async ([{ data: proj, error: e1 }, { data: items, error: e2 }]) => {
            if (e1) { setError(e1.message); setLoading(false); return }
            if (e2) { setError(e2.message); setLoading(false); return }

            const enriched = (items || []).map(item => ({
                ...item,
                resource_type: item.resources?.resource_type || item.resource_type || 'Material',
            }))

            // Recalculate and sync total_cost using correct unit-based logic
            const liveTotal = enriched.reduce((sum, i) => sum + lineItemTotal(i), 0)

            // Fire-and-forget sync to DB so cards stay accurate on next load
            if (proj && Math.abs((proj.total_cost || 0) - liveTotal) > 0.01) {
                supabase
                    .from('projects')
                    .update({ total_cost: liveTotal })
                    .eq('id', projectId)
                    .then(() => { }) // non-blocking
            }

            setProject(proj ? { ...proj, total_cost: liveTotal } : null)
            setLineItems(enriched)
            setLoading(false)
        })
    }, [projectId])

    return { project, lineItems, loading, error }
}