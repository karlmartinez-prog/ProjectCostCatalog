import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useSuppliers(search = '') {
    const [suppliers, setSuppliers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetchSuppliers = useCallback(async () => {
        setLoading(true)
        setError(null)

        let query = supabase
            .from('suppliers')
            .select('*')
            .order('name')

        if (search) query = query.ilike('name', `%${search}%`)

        const { data, error } = await query
        if (error) setError(error.message)
        else setSuppliers(data || [])
        setLoading(false)
    }, [search])

    useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

    async function createSupplier(payload) {
        const { data, error } = await supabase
            .from('suppliers')
            .insert([payload])
            .select('*')
            .single()
        if (error) throw error
        setSuppliers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        return data
    }

    async function updateSupplier(id, payload) {
        const { data, error } = await supabase
            .from('suppliers')
            .update(payload)
            .eq('id', id)
            .select('*')
            .single()
        if (error) throw error
        setSuppliers(prev => prev.map(s => s.id === id ? data : s))
        return data
    }

    async function deleteSupplier(id) {
        const { error } = await supabase.from('suppliers').delete().eq('id', id)
        if (error) throw error
        setSuppliers(prev => prev.filter(s => s.id !== id))
    }

    return { suppliers, loading, error, createSupplier, updateSupplier, deleteSupplier, refetch: fetchSuppliers }
}

export function useSupplierDetail(supplierId) {
    const [supplier, setSupplier] = useState(null)
    const [resources, setResources] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!supplierId) return
        setLoading(true)
        setError(null)

        Promise.all([
            supabase.from('suppliers').select('*').eq('id', supplierId).single(),
            supabase
                .from('resources')
                .select('*, categories(id, name, type)')
                .eq('supplier_id', supplierId)
                .order('created_at', { ascending: false })
        ]).then(([{ data: sup, error: e1 }, { data: res, error: e2 }]) => {
            if (e1) setError(e1.message)
            else if (e2) setError(e2.message)
            else {
                setSupplier(sup)
                setResources(res || [])
            }
            setLoading(false)
        })
    }, [supplierId])

    return { supplier, resources, loading, error }
}