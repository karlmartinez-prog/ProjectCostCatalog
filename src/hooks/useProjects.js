import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

// ── Compute line item total ────────────────────────────
// Labor: daily_rate × workers × working_days
// Others: unit_cost × quantity
function lineItemTotal(item) {
    const cost = parseFloat(item.unit_cost_snapshot) || 0
    const qty = parseInt(item.quantity) || 1
    if ((item._resource_type || item.resource_type) === 'Labor' && item.working_days) {
        return cost * qty * item.working_days
    }
    return cost * qty
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
        // 1. Insert project
        const { data: project, error: pErr } = await supabase
            .from('projects')
            .insert([projectPayload])
            .select('*')
            .maybeSingle()
        if (pErr) throw pErr
        if (!project) throw new Error('Failed to create project — check RLS policies.')

        // 2. Insert all line items into project_resources
        const items = lineItems || []
        if (items.length > 0) {
            const rows = items.map(item => ({
                project_id: project.id,
                resource_id: item.resource_id || null,
                resource_type: item._resource_type || 'Material',
                custom_name: item._name && !item.resource_id ? item._name : null,
                unit_cost_snapshot: parseFloat(item.unit_cost_snapshot) || 0,
                quantity: parseInt(item.quantity) || 1,
                capex_opex: item.capex_opex || null,
                working_days: item.working_days || null,
                labor_start_date: item.labor_start_date || null,
                labor_end_date: item.labor_end_date || null,
            }))
            const { error: liErr } = await supabase.from('project_resources').insert(rows)
            if (liErr) throw liErr
        }

        // 3. Compute and store total_cost
        const total = items.reduce((sum, i) => sum + lineItemTotal(i), 0)
        await supabase.from('projects').update({ total_cost: total }).eq('id', project.id)

        const final = { ...project, total_cost: total }
        setProjects(prev => [final, ...prev])
        return final
    }

    async function updateProject(id, projectPayload, lineItems) {
        const { data: project, error: pErr } = await supabase
            .from('projects')
            .update(projectPayload)
            .eq('id', id)
            .select('*')
            .maybeSingle()
        if (pErr) throw pErr
        if (!project) throw new Error('Update failed — check RLS policies.')

        if (lineItems !== undefined) {
            const items = lineItems || []

            // Replace all project_resources rows
            await supabase.from('project_resources').delete().eq('project_id', id)

            if (items.length > 0) {
                const rows = items.map(item => ({
                    project_id: id,
                    resource_id: item.resource_id || null,
                    resource_type: item._resource_type || 'Material',
                    custom_name: item._name && !item.resource_id ? item._name : null,
                    unit_cost_snapshot: parseFloat(item.unit_cost_snapshot) || 0,
                    quantity: parseInt(item.quantity) || 1,
                    capex_opex: item.capex_opex || null,
                    working_days: item.working_days || null,
                    labor_start_date: item.labor_start_date || null,
                    labor_end_date: item.labor_end_date || null,
                }))
                const { error: liErr } = await supabase.from('project_resources').insert(rows)
                if (liErr) throw liErr
            }

            const total = items.reduce((sum, i) => sum + lineItemTotal(i), 0)
            await supabase.from('projects').update({ total_cost: total }).eq('id', id)
            project.total_cost = total
        }

        setProjects(prev => prev.map(p => p.id === id ? project : p))
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

            setProject(proj)
            setLineItems(enriched)
            setLoading(false)

            // Sync stored total_cost to match the live calculation
            // Fire-and-forget — updates projects table so catalog cards stay accurate
            try {
                const { recalcProjectTotal } = await import('./useLabor.js')
                await recalcProjectTotal(projectId)
            } catch (_) {
                // Non-critical — detail page always shows the live calculated total anyway
            }
        })
    }, [projectId])

    return { project, lineItems, loading, error }
}