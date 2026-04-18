import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// ── User profile ──────────────────────────────────────
export function useProfile() {
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return setLoading(false)
            supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle()
                .then(({ data }) => {
                    setProfile(data || { id: user.id, full_name: '', avatar_url: '', role: 'viewer' })
                    setLoading(false)
                })
        })
    }, [])

    async function updateProfile(payload) {
        setSaving(true)
        setError(null)
        const { data, error } = await supabase
            .from('profiles')
            .update(payload)
            .eq('id', profile.id)
            .select('*')
            .maybeSingle()
        if (error) { setError(error.message); setSaving(false); throw error }
        if (!data) { setError('Update failed — check RLS policies.'); setSaving(false); throw new Error('no data') }
        setProfile(data)
        setSaving(false)
        return data
    }

    async function uploadAvatar(file) {
        setSaving(true)
        setError(null)
        const ext = file.name.split('.').pop()
        const path = `avatars/${profile.id}.${ext}`
        const { error: upErr } = await supabase.storage
            .from('avatars')
            .upload(path, file, { upsert: true })
        if (upErr) { setError(upErr.message); setSaving(false); throw upErr }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        const updated = await updateProfile({ avatar_url: urlData.publicUrl })
        setSaving(false)
        return updated
    }

    return { profile, loading, saving, error, updateProfile, uploadAvatar }
}

// ── Categories ────────────────────────────────────────
export function useCategories() {
    const [categories, setCategories] = useState([])
    const [resourceCounts, setResourceCounts] = useState({}) // { categoryId: count }
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function fetch() {
            setLoading(true)
            const [{ data: cats, error: e1 }, { data: resources, error: e2 }] = await Promise.all([
                supabase.from('categories').select('*').order('name'),
                supabase.from('resources').select('category_id'),
            ])
            if (e1 || e2) { setError((e1 || e2).message); setLoading(false); return }
            setCategories(cats || [])
            const counts = {}
            for (const r of resources || []) {
                if (r.category_id) counts[r.category_id] = (counts[r.category_id] || 0) + 1
            }
            setResourceCounts(counts)
            setLoading(false)
        }
        fetch()
    }, [])

    async function createCategory(payload) {
        const { data, error } = await supabase
            .from('categories')
            .insert([payload])
            .select('*')
            .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Insert failed — check RLS policies.')
        setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        return data
    }

    async function updateCategory(id, payload) {
        const { data, error } = await supabase
            .from('categories')
            .update(payload)
            .eq('id', id)
            .select('*')
            .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Update failed — check RLS policies.')
        setCategories(prev => prev.map(c => c.id === id ? data : c))
        return data
    }

    async function deleteCategory(id) {
        const { error } = await supabase.from('categories').delete().eq('id', id)
        if (error) throw error
        setCategories(prev => prev.filter(c => c.id !== id))
        setResourceCounts(prev => { const n = { ...prev }; delete n[id]; return n })
    }

    return { categories, resourceCounts, loading, error, createCategory, updateCategory, deleteCategory }
}