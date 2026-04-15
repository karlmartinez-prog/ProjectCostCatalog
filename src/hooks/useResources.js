import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useResources(filters = {}) {
    const [resources, setResources] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function fetch() {
            setLoading(true)
            let query = supabase
                .from('resources')
                .select(`*, categories(*), suppliers(*)`)
                .order('created_at', { ascending: false })

            if (filters.category_id) query = query.eq('category_id', filters.category_id)
            if (filters.supplier_id) query = query.eq('supplier_id', filters.supplier_id)
            if (filters.status) query = query.eq('status', filters.status)
            if (filters.search) query = query.ilike('name', `%${filters.search}%`)

            const { data, error } = await query
            if (error) setError(error.message)
            else setResources(data)
            setLoading(false)
        }
        fetch()
    }, [filters.category_id, filters.supplier_id, filters.status, filters.search])

    return { resources, loading, error }
}