import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export const PHASE_STATUSES = [
    { value: 'not_started', label: 'Not Started', color: '#aaa89f' },
    { value: 'in_progress', label: 'In Progress', color: '#c9a84c' },
    { value: 'done', label: 'Done', color: '#16a34a' },
    { value: 'blocked', label: 'Blocked', color: '#dc2626' },
]

export function getStatusConfig(status) {
    return PHASE_STATUSES.find(s => s.value === status) ?? PHASE_STATUSES[0]
}

export function useProjectPhases(projectId) {
    const [phases, setPhases] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetch = useCallback(async () => {
        if (!projectId) return
        setLoading(true)
        setError(null)
        const { data, error } = await supabase
            .from('project_phases')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order', { ascending: true })
            .order('start_date', { ascending: true })
        if (error) setError(error.message)
        else setPhases(data || [])
        setLoading(false)
    }, [projectId])

    useEffect(() => { fetch() }, [fetch])

    // ── Create ────────────────────────────────────────
    async function addPhase(partial = {}) {
        // Default start/end to today + 7 days if not supplied
        const today = new Date().toISOString().slice(0, 10)
        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
        const maxOrder = phases.length ? Math.max(...phases.map(p => p.sort_order)) : -1

        const row = {
            project_id: projectId,
            name: partial.name ?? 'New Phase',
            status: partial.status ?? 'not_started',
            start_date: partial.start_date ?? today,
            end_date: partial.end_date ?? nextWeek,
            notes: partial.notes ?? null,
            assigned_to: partial.assigned_to ?? null,
            sort_order: partial.sort_order ?? maxOrder + 1,
        }

        const { data, error } = await supabase
            .from('project_phases')
            .insert([row])
            .select('*')
            .maybeSingle()

        if (error) throw error
        if (data) setPhases(prev => [...prev, data].sort((a, b) => a.sort_order - b.sort_order))
        return data
    }

    // ── Update ────────────────────────────────────────
    async function updatePhase(id, changes) {
        const { data, error } = await supabase
            .from('project_phases')
            .update(changes)
            .eq('id', id)
            .select('*')
            .maybeSingle()

        if (error) throw error
        if (data) setPhases(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
        return data
    }

    // ── Delete ────────────────────────────────────────
    async function deletePhase(id) {
        const { error } = await supabase
            .from('project_phases')
            .delete()
            .eq('id', id)

        if (error) throw error
        setPhases(prev => prev.filter(p => p.id !== id))
    }

    // ── Reorder (drag or move up/down) ────────────────
    // Accepts the full reordered array and bulk-updates sort_order
    async function reorderPhases(reordered) {
        // Optimistic update
        setPhases(reordered.map((p, i) => ({ ...p, sort_order: i })))

        const updates = reordered.map((p, i) =>
            supabase.from('project_phases').update({ sort_order: i }).eq('id', p.id)
        )
        await Promise.all(updates)
    }

    return { phases, loading, error, addPhase, updatePhase, deletePhase, reorderPhases, refetch: fetch }
}