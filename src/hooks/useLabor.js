import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

// useProjectLabor — reads/writes project_resources filtered by resource_type = 'Labor'
// Also manages project_holidays (unchanged)
export function useProjectLabor(projectId) {
    const [laborItems, setLaborItems] = useState([])
    const [holidays, setHolidays] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetch = useCallback(async () => {
        if (!projectId) return
        setLoading(true)
        const [{ data: labor, error: e1 }, { data: hols, error: e2 }] = await Promise.all([
            supabase
                .from('project_resources')
                .select(`
          *,
          resources(id, name, image_url, unit, currency, resource_type, trade, procured_at, categories(id, name, type))
        `)
                .eq('project_id', projectId)
                .eq('resource_type', 'Labor')
                .order('created_at'),
            supabase
                .from('project_holidays')
                .select('*')
                .eq('project_id', projectId)
                .order('date'),
        ])
        if (e1 || e2) { setError((e1 || e2).message); setLoading(false); return }
        setLaborItems(labor || [])
        setHolidays(hols || [])
        setLoading(false)
    }, [projectId])

    useEffect(() => { fetch() }, [fetch])

    async function addLaborItem(payload) {
        // payload has: resource_id, custom_name, unit_cost_snapshot (daily_rate),
        //              quantity (headcount), working_days, labor_start_date, labor_end_date
        const { data, error } = await supabase
            .from('project_resources')
            .insert([{
                project_id: projectId,
                resource_id: payload.labor_resource_id || null,
                resource_type: 'Labor',
                custom_name: payload.custom_name || null,
                unit_cost_snapshot: payload.daily_rate,
                quantity: payload.headcount || 1,
                working_days: payload.working_days || null,
                labor_start_date: payload.start_date || null,
                labor_end_date: payload.end_date || null,
                capex_opex: payload.capex_opex || 'OPEX',
            }])
            .select(`
        *,
        resources(id, name, image_url, unit, currency, resource_type, trade, procured_at, categories(id, name, type))
      `)
            .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Insert failed.')
        setLaborItems(prev => [...prev, data])

        // Also update project total_cost
        await recalcProjectTotal(projectId)

        return data
    }

    async function updateLaborItem(id, payload) {
        const { data, error } = await supabase
            .from('project_resources')
            .update({
                unit_cost_snapshot: payload.daily_rate ?? undefined,
                quantity: payload.headcount ?? undefined,
                working_days: payload.working_days ?? undefined,
                labor_start_date: payload.start_date ?? undefined,
                labor_end_date: payload.end_date ?? undefined,
                total_cost: payload.total_cost ?? undefined,
            })
            .eq('id', id)
            .select(`
        *,
        resources(id, name, image_url, unit, currency, resource_type, trade, procured_at, categories(id, name, type))
      `)
            .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Update failed.')
        setLaborItems(prev => prev.map(l => l.id === id ? data : l))
        await recalcProjectTotal(projectId)
        return data
    }

    async function deleteLaborItem(id) {
        const { error } = await supabase
            .from('project_resources')
            .delete()
            .eq('id', id)
        if (error) throw error
        setLaborItems(prev => prev.filter(l => l.id !== id))
        await recalcProjectTotal(projectId)
    }

    async function addHoliday(date, name) {
        const { data, error } = await supabase
            .from('project_holidays')
            .insert([{ project_id: projectId, date, name }])
            .select('*')
            .maybeSingle()
        if (error) throw error
        if (data) setHolidays(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)))
        return data
    }

    async function deleteHoliday(id) {
        const { error } = await supabase
            .from('project_holidays')
            .delete()
            .eq('id', id)
        if (error) throw error
        setHolidays(prev => prev.filter(h => h.id !== id))
    }

    return {
        laborItems, holidays, loading, error,
        addLaborItem, updateLaborItem, deleteLaborItem,
        addHoliday, deleteHoliday,
        refetch: fetch,
    }
}

// Exported so useProjectDetail can import it to sync stored total_cost
export async function recalcProjectTotal(projectId) {
    const [{ data: proj }, { data: items }] = await Promise.all([
        supabase.from('projects')
            .select('start_date, end_date, working_days_mode')
            .eq('id', projectId)
            .single(),
        supabase.from('project_resources')
            .select('unit_cost_snapshot, quantity, working_days, resource_type, labor_start_date, labor_end_date')
            .eq('project_id', projectId),
    ])

    const mode = proj?.working_days_mode || 'working_days'

    function resolveWorkingDays(item) {
        if (item.working_days) return item.working_days
        if (item.resource_type !== 'Labor') return null
        const start = item.labor_start_date || proj?.start_date
        const end = item.labor_end_date || proj?.end_date
        if (!start || !end) return 0
        if (mode === 'working_days') {
            // Count weekdays only
            const s = new Date(start); s.setHours(0, 0, 0, 0)
            const e = new Date(end); e.setHours(0, 0, 0, 0)
            let count = 0
            const cur = new Date(s)
            while (cur <= e) {
                const day = cur.getDay()
                if (day !== 0 && day !== 6) count++
                cur.setDate(cur.getDate() + 1)
            }
            return count
        } else {
            return Math.max(0, Math.round((new Date(end) - new Date(start)) / 86400000) + 1)
        }
    }

    const total = (items || []).reduce((sum, item) => {
        const cost = item.unit_cost_snapshot || 0
        const qty = item.quantity || 1
        if (item.resource_type === 'Labor') {
            const days = resolveWorkingDays(item)
            return sum + cost * qty * (days || 0)
        }
        return sum + cost * qty
    }, 0)

    await supabase
        .from('projects')
        .update({ total_cost: total })
        .eq('id', projectId)

    return total
}