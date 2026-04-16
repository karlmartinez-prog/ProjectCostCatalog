import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useResources(filters = {}) {
    const [resources, setResources] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetchResources = useCallback(async () => {
        setLoading(true)
        setError(null)

        let query = supabase
            .from('resources')
            .select(`
        *,
        categories ( id, name, type ),
        suppliers ( id, name )
      `)
            .order('created_at', { ascending: false })

        if (filters.category_id) query = query.eq('category_id', filters.category_id)
        if (filters.supplier_id) query = query.eq('supplier_id', filters.supplier_id)
        if (filters.status) query = query.eq('status', filters.status)
        if (filters.search) query = query.ilike('name', `%${filters.search}%`)

        const { data, error } = await query
        if (error) setError(error.message)
        else setResources(data || [])
        setLoading(false)
    }, [filters.category_id, filters.supplier_id, filters.status, filters.search])

    useEffect(() => { fetchResources() }, [fetchResources])

    async function createResource(payload) {
        const { data, error } = await supabase
            .from('resources')
            .insert([payload])
            .select(`*, categories(id,name,type), suppliers(id,name)`)
            .single()
        if (error) throw error
        setResources(prev => [data, ...prev])
        return data
    }

    async function updateResource(id, payload) {
        const { data, error } = await supabase
            .from('resources')
            .update(payload)
            .eq('id', id)
            .select(`*, categories(id,name,type), suppliers(id,name)`)
            .single()
        if (error) throw error
        setResources(prev => prev.map(r => r.id === id ? data : r))
        return data
    }

    async function deleteResource(id) {
        const { error } = await supabase.from('resources').delete().eq('id', id)
        if (error) throw error
        setResources(prev => prev.filter(r => r.id !== id))
    }

    return { resources, loading, error, refetch: fetchResources, createResource, updateResource, deleteResource }
}

export function useCategories() {
    const [categories, setCategories] = useState([])
    useEffect(() => {
        supabase.from('categories').select('*').order('name')
            .then(({ data }) => setCategories(data || []))
    }, [])
    return categories
}

// Lightweight supplier list for dropdowns (used in ResourceModal)
export function useSupplierList() {
    const [suppliers, setSuppliers] = useState([])
    useEffect(() => {
        supabase.from('suppliers').select('id, name').order('name')
            .then(({ data }) => setSuppliers(data || []))
    }, [])
    return suppliers
}