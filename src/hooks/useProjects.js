import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

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
            .single()
        if (pErr) throw pErr

        // 2. Insert line items
        if (lineItems && lineItems.length > 0) {
            const rows = lineItems.map(item => ({
                project_id: project.id,
                resource_id: item.resource_id || null,
                quantity: item.quantity,
                unit_cost_snapshot: item.unit_cost_snapshot,
                capex_opex: item.capex_opex || null,
            }))
            const { error: liErr } = await supabase.from('project_resources').insert(rows)
            if (liErr) throw liErr
        }

        // 3. Update total_cost on project
        const total = lineItems.reduce((sum, i) => sum + i.unit_cost_snapshot * i.quantity, 0)
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
            .single()
        if (pErr) throw pErr

        if (lineItems !== undefined) {
            // Replace all line items
            await supabase.from('project_resources').delete().eq('project_id', id)
            if (lineItems.length > 0) {
                const rows = lineItems.map(item => ({
                    project_id: id,
                    resource_id: item.resource_id || null,
                    quantity: item.quantity,
                    unit_cost_snapshot: item.unit_cost_snapshot,
                    capex_opex: item.capex_opex || null,
                }))
                const { error: liErr } = await supabase.from('project_resources').insert(rows)
                if (liErr) throw liErr
            }
            const total = lineItems.reduce((sum, i) => sum + i.unit_cost_snapshot * i.quantity, 0)
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
            supabase.from('projects').select('*').eq('id', projectId).single(),
            supabase
                .from('project_resources')
                .select('*, resources(id, name, image_url, unit, currency, categories(id, name, type))')
                .eq('project_id', projectId)
                .order('created_at'),
        ]).then(([{ data: proj, error: e1 }, { data: items, error: e2 }]) => {
            if (e1) setError(e1.message)
            else if (e2) setError(e2.message)
            else {
                setProject(proj)
                setLineItems(items || [])
            }
            setLoading(false)
        })
    }, [projectId])

    return { project, lineItems, loading, error }
}