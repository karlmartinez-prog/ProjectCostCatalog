import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useSites() {
    const [sites, setSites] = useState([])
    const [projectCounts, setProjectCounts] = useState({}) // { siteId: count }
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function fetch() {
            setLoading(true)
            const [{ data: sitesData, error: e1 }, { data: projects, error: e2 }] = await Promise.all([
                supabase.from('sites').select('*').order('name'),
                supabase.from('projects').select('site_id'),
            ])
            if (e1 || e2) { setError((e1 || e2).message); setLoading(false); return }
            setSites(sitesData || [])
            const counts = {}
            for (const p of projects || []) {
                if (p.site_id) counts[p.site_id] = (counts[p.site_id] || 0) + 1
            }
            setProjectCounts(counts)
            setLoading(false)
        }
        fetch()
    }, [])

    async function createSite(payload) {
        const { data, error } = await supabase
            .from('sites')
            .insert([payload])
            .select('*')
            .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Insert failed — check RLS policies.')
        setSites(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        return data
    }

    async function updateSite(id, payload) {
        const { data, error } = await supabase
            .from('sites')
            .update(payload)
            .eq('id', id)
            .select('*')
            .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Update failed — check RLS policies.')
        setSites(prev => prev.map(s => s.id === id ? data : s))
        return data
    }

    async function deleteSite(id) {
        const { error } = await supabase.from('sites').delete().eq('id', id)
        if (error) throw error
        setSites(prev => prev.filter(s => s.id !== id))
        setProjectCounts(prev => { const n = { ...prev }; delete n[id]; return n })
    }

    return { sites, projectCounts, loading, error, createSite, updateSite, deleteSite }
}

// Lightweight read-only hook for dropdowns (no project counts needed)
export function useSitesReadonly() {
    const [sites, setSites] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        supabase.from('sites').select('id, name, code, address').order('name')
            .then(({ data }) => { setSites(data || []); setLoading(false) })
    }, [])

    return { sites, loading }
}