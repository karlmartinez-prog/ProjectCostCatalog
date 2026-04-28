import { useState, useEffect } from 'react'
import { Plus, Trash2, X, HardHat, Calendar, AlertTriangle, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { useProjectLabor } from '../../hooks/useLabor'
import { supabase } from '../../lib/supabaseClient'
import { countWorkingDays, resolveLaborItem, laborCostLabel, listExcludedDays } from '../../services/laborEngine'

function fmt(amount, currency = 'PHP') {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount || 0)
}

function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Add labor item form ───────────────────────────────
function AddLaborForm({ project, holidays, onAdd, onCancel }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [open, setOpen] = useState(false)

    async function searchLabor(q) {
        if (!q.trim()) { setResults([]); return }
        setSearching(true)
        const { data } = await supabase
            .from('resources')
            .select('id, name, unit_cost, currency, unit, trade, resource_type, categories(id, name, type)')
            .eq('resource_type', 'Labor')
            .ilike('name', `%${q}%`)
            .limit(8)
        setResults(data || [])
        setSearching(false)
    }

    // Also load all labor resources for the full list
    const [allLabor, setAllLabor] = useState([])
    useEffect(() => {
        supabase.from('resources')
            .select('id, name, unit_cost, currency, unit, trade, resource_type, categories(id, name, type)')
            .eq('resource_type', 'Labor')
            .order('name')
            .then(({ data }) => setAllLabor(data || []))
    }, [])
    const [form, setForm] = useState({
        labor_resource_id: null,
        custom_name: '',
        daily_rate: '',
        currency: project.currency || 'PHP',
        headcount: 1,
        start_date: '',
        end_date: '',
        capex_opex: 'OPEX',   // default OPEX, auto-set from category on pick
        isCustom: false,
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

    function pickResource(r) {
        // Auto-set capex_opex from the resource's category type, fallback to OPEX
        const capexOpex = r.categories?.type || 'OPEX'
        setForm(p => ({
            ...p,
            labor_resource_id: r.id,
            custom_name: r.name,
            daily_rate: r.unit_cost,
            currency: r.currency,
            capex_opex: capexOpex,
            isCustom: false,
        }))
        setQuery(r.name)
        setOpen(false)
    }

    function useCustom() {
        setForm(p => ({ ...p, labor_resource_id: null, isCustom: true }))
    }

    const filteredLabor = query.trim() ? results : allLabor

    const effectiveStart = form.start_date || project.start_date
    const effectiveEnd = form.end_date || project.end_date
    const workingDays = countWorkingDays(effectiveStart, effectiveEnd, holidays)
    const previewCost = (parseFloat(form.daily_rate) || 0) * (parseInt(form.headcount) || 1) * workingDays

    async function handleAdd() {
        const name = form.custom_name || ''
        if (!name.trim()) return setError('Select a labor resource or enter a custom name.')
        if (!form.daily_rate || isNaN(form.daily_rate)) return setError('Enter a valid daily rate.')
        setSaving(true); setError(null)
        try {
            const payload = {
                labor_resource_id: form.labor_resource_id || null,
                custom_name: form.isCustom ? form.custom_name : null,
                daily_rate: parseFloat(form.daily_rate),
                currency: form.currency,
                headcount: parseInt(form.headcount) || 1,
                start_date: form.start_date || null,
                end_date: form.end_date || null,
                working_days: workingDays,
                capex_opex: form.capex_opex || 'OPEX',
            }
            await onAdd(payload)
            onCancel()
        } catch (e) { setError(e.message) }
        setSaving(false)
    }


    return (
        <div className="plb-add-form">
            <div className="plb-add-title">Add labor to project</div>

            {/* Search labor catalog */}
            {!form.isCustom && (
                <div style={{ position: 'relative', marginBottom: 12 }}>
                    <div className="rp-input-row">
                        <Search size={14} strokeWidth={1.5} />
                        <input
                            placeholder="Search labor catalog…"
                            value={query}
                            onChange={e => { setQuery(e.target.value); searchLabor(e.target.value); setOpen(true) }}
                            onFocus={() => setOpen(true)}
                            onBlur={() => setTimeout(() => setOpen(false), 150)}
                        />
                    </div>
                    {open && (
                        <div className="rp-dropdown">
                            {searching && <div className="rp-hint">Searching…</div>}
                            {!searching && filteredLabor.length === 0 && (
                                <div className="rp-hint">No labor resources found. Add them in Resource Catalog.</div>
                            )}
                            {filteredLabor.map(r => (
                                <button key={r.id} className="rp-result" onMouseDown={() => pickResource(r)}>
                                    <HardHat size={13} strokeWidth={1.5} style={{ color: '#c9a84c' }} />
                                    <div className="rp-result-info">
                                        <span className="rp-result-name">{r.name}</span>
                                        <span className="rp-result-cat">
                                            {r.trade && <span>{r.trade}</span>}
                                            {r.categories && (
                                                <span className={`rp-type-pill ${r.categories.type === 'CAPEX' ? 'capex' : 'opex'}`}>
                                                    {r.categories.type}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <span className="rp-result-cost">{fmt(r.unit_cost, r.currency)}/day</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="proj-divider"><span>or</span></div>

            {!form.isCustom ? (
                <button type="button" className="proj-add-custom-btn" style={{ marginBottom: 12 }} onClick={useCustom}>
                    <Plus size={14} /> Add custom labor
                </button>
            ) : (
                <div className="mf-group" style={{ marginBottom: 12 }}>
                    <label>Custom name</label>
                    <input value={form.custom_name} onChange={e => set('custom_name', e.target.value)} placeholder="e.g. Skilled Laborer" />
                </div>
            )}

            <div className="plb-fields">
                <div className="mf-group">
                    <label>Daily rate</label>
                    <input type="number" min="0" step="0.01" value={form.daily_rate} onChange={e => set('daily_rate', e.target.value)} placeholder="800.00" />
                </div>
                <div className="mf-group">
                    <label>Workers</label>
                    <input type="number" min="1" value={form.headcount} onChange={e => set('headcount', e.target.value)} />
                </div>
                <div className="mf-group">
                    <label>Start date <span style={{ color: '#aaa89f', fontWeight: 400 }}>(optional override)</span></label>
                    <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                </div>
                <div className="mf-group">
                    <label>End date <span style={{ color: '#aaa89f', fontWeight: 400 }}>(optional override)</span></label>
                    <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                </div>
            </div>

            {/* Formula preview */}
            {form.daily_rate && workingDays > 0 && (
                <div className="plb-preview">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span className="plb-preview-days">{workingDays} working days</span>
                        <span className={`badge ${form.capex_opex === 'CAPEX' ? 'badge-blue' : 'badge-purple'}`} style={{ fontSize: 11 }}>
                            {form.capex_opex}
                        </span>
                    </div>
                    <span className="plb-preview-formula">
                        {laborCostLabel(parseFloat(form.daily_rate) || 0, parseInt(form.headcount) || 1, workingDays, form.currency)}
                    </span>
                </div>
            )}
            {form.daily_rate && !workingDays && !(effectiveStart && effectiveEnd) && (
                <div style={{ fontSize: 12, color: '#f08c00', background: '#fef6e0', borderRadius: 8, padding: '8px 12px', border: '1px solid #fde68a' }}>
                    Set project dates (or override dates below) to see the cost formula.
                </div>
            )}

            {error && <div className="modal-error" style={{ marginTop: 8 }}>{error}</div>}

            <div className="modal-actions" style={{ marginTop: 12 }}>
                <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="button" className="btn-primary" onClick={handleAdd} disabled={saving}>
                    {saving ? 'Adding…' : 'Add labor'}
                </button>
            </div>
        </div>
    )
}

// ── Holiday manager ───────────────────────────────────
function HolidayManager({ holidays, onAdd, onDelete }) {
    const [date, setDate] = useState('')
    const [name, setName] = useState('')
    const [open, setOpen] = useState(false)
    const [error, setError] = useState(null)

    async function handleAdd() {
        if (!date || !name.trim()) return setError('Both date and name are required.')
        setError(null)
        try { await onAdd(date, name.trim()); setDate(''); setName('') }
        catch (e) { setError(e.message) }
    }

    return (
        <div className="plb-holiday-section">
            <button className="plb-holiday-toggle" onClick={() => setOpen(o => !o)}>
                <Calendar size={14} strokeWidth={1.5} />
                Custom holidays for this project
                <span className="plb-holiday-count">{holidays.length}</span>
                {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {open && (
                <div className="plb-holiday-body">
                    <p style={{ fontSize: 12.5, color: '#7a7872', marginBottom: 12 }}>
                        These dates will be excluded from working day counts for all labor on this project,
                        in addition to weekends and PH public holidays.
                    </p>

                    {/* Add row */}
                    <div className="plb-holiday-add">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="proj-item-input" />
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Holiday name" className="proj-item-input" style={{ flex: 2 }} />
                        <button className="btn-primary" onClick={handleAdd} style={{ padding: '8px 14px', fontSize: 13 }}>
                            <Plus size={13} /> Add
                        </button>
                    </div>
                    {error && <div style={{ fontSize: 12, color: '#b93030', marginTop: 6 }}>{error}</div>}

                    {holidays.length > 0 && (
                        <div className="plb-holiday-list">
                            {holidays.map(h => (
                                <div key={h.id} className="plb-holiday-row">
                                    <span className="plb-holiday-date">{formatDate(h.date)}</span>
                                    <span className="plb-holiday-name">{h.name}</span>
                                    <button className="rc-btn rc-btn-danger" onClick={() => onDelete(h.id)}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Main tab ──────────────────────────────────────────
export default function ProjectLaborTab({ project }) {
    const { laborItems, holidays, loading, error, addLaborItem, updateLaborItem, deleteLaborItem, addHoliday, deleteHoliday } = useProjectLabor(project.id)
    const [showAdd, setShowAdd] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [toast, setToast] = useState(null)
    const [expandedId, setExpandedId] = useState(null)

    function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

    async function handleDelete() {
        setDeleteLoading(true)
        try { await deleteLaborItem(deleteTarget.id); showToast('Removed.', 'danger') }
        catch (e) { showToast(e.message, 'danger') }
        setDeleteLoading(false); setDeleteTarget(null)
    }

    // Recalculate costs live from the engine
    const resolvedItems = laborItems.map(item => {
        const { workingDays, totalCost } = resolveLaborItem(item, project.start_date, project.end_date, holidays)
        return { ...item, _workingDays: workingDays, _totalCost: totalCost }
    })

    const grandTotal = resolvedItems.reduce((s, i) => s + i._totalCost, 0)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && <div className="rc-error"><AlertTriangle size={14} /> {error}</div>}

            {/* Holiday manager */}
            <HolidayManager holidays={holidays} onAdd={addHoliday} onDelete={deleteHoliday} />

            {/* Labor list */}
            <div className="card pjd-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div className="pjd-section-title">
                        <HardHat size={15} strokeWidth={1.5} /> Labor costs
                    </div>
                    <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ padding: '7px 14px', fontSize: 13 }}>
                        <Plus size={13} strokeWidth={2} /> Add labor
                    </button>
                </div>

                {loading && <div style={{ color: '#aaa89f', fontSize: 13.5 }}>Loading…</div>}

                {!loading && resolvedItems.length === 0 && !showAdd && (
                    <div className="rc-empty" style={{ padding: '32px 0' }}>
                        <div className="rc-empty-icon" style={{ fontSize: 28 }}>👷</div>
                        <p style={{ fontSize: 14 }}>No labor assigned yet</p>
                        <span>Add workers to calculate timeline-based labor costs.</span>
                        <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => setShowAdd(true)}>
                            <Plus size={14} /> Add labor
                        </button>
                    </div>
                )}

                {showAdd && (
                    <AddLaborForm
                        project={project}
                        holidays={holidays}
                        onAdd={async payload => { await addLaborItem(payload); showToast('Labor added.') }}
                        onCancel={() => setShowAdd(false)}
                    />
                )}

                {resolvedItems.length > 0 && (
                    <>
                        <table className="rc-table">
                            <thead>
                                <tr>
                                    <th>Worker</th>
                                    <th style={{ textAlign: 'center' }}>Workers</th>
                                    <th style={{ textAlign: 'right' }}>Daily rate</th>
                                    <th style={{ textAlign: 'center' }}>Work days</th>
                                    <th style={{ textAlign: 'right' }}>Total cost</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {resolvedItems.map(item => {
                                    const isExpanded = expandedId === item.id
                                    const name = item.resources?.name || item.custom_name || 'Custom labor'
                                    const trade = item.resources?.trade
                                    const hasOverride = item.start_date || item.end_date
                                    const excluded = isExpanded ? listExcludedDays(
                                        item.start_date || project.start_date,
                                        item.end_date || project.end_date,
                                        holidays
                                    ) : []

                                    return (
                                        <>
                                            <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a84c', flexShrink: 0 }}>
                                                            <HardHat size={14} strokeWidth={1.5} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{name}</div>
                                                            <div style={{ fontSize: 11.5, color: '#9a9790', display: 'flex', gap: 6, alignItems: 'center' }}>
                                                                {trade && <span>{trade}</span>}
                                                                {hasOverride && <span style={{ color: '#c9a84c' }}>· custom dates</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center', color: '#4a4844', fontWeight: 500 }}>{item.quantity ?? item.headcount ?? 1}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(item.unit_cost_snapshot ?? item.daily_rate, item.currency)}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span style={{ fontWeight: 650, color: '#1a1917' }}>{item._workingDays}</span>
                                                    <span style={{ fontSize: 11, color: '#aaa89f', marginLeft: 3 }}>days</span>
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#1a1917' }}>
                                                    {fmt(item._totalCost, item.currency)}
                                                </td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <button className="rc-btn rc-btn-danger" onClick={() => setDeleteTarget(item)}>
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* Expanded detail */}
                                            {isExpanded && (
                                                <tr key={`${item.id}-detail`}>
                                                    <td colSpan={6} style={{ background: '#faf9f7', padding: '12px 16px' }}>
                                                        <div style={{ fontSize: 12.5, color: '#4a4844', marginBottom: 8 }}>
                                                            <strong>Date range:</strong> {formatDate(item.start_date || project.start_date)} → {formatDate(item.end_date || project.end_date)}
                                                        </div>
                                                        <div style={{ fontSize: 12.5, color: '#4a4844', marginBottom: 8 }}>
                                                            <strong>Calculation:</strong> {laborCostLabel(item.unit_cost_snapshot ?? item.daily_rate, item.quantity ?? item.headcount ?? 1, item._workingDays, item.currency)}
                                                        </div>
                                                        {excluded.length > 0 && (
                                                            <div>
                                                                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#9a9790', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                                                                    Excluded days ({excluded.length})
                                                                </div>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                                    {excluded.slice(0, 20).map(e => (
                                                                        <span key={e.date} style={{ fontSize: 11, background: '#f0ede8', padding: '2px 8px', borderRadius: 99, color: '#6b6864' }}>
                                                                            {new Date(e.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · {e.reason}
                                                                        </span>
                                                                    ))}
                                                                    {excluded.length > 20 && (
                                                                        <span style={{ fontSize: 11, color: '#aaa89f' }}>+{excluded.length - 20} more</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </tbody>
                        </table>

                        {/* Grand total */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#1a1917', borderRadius: '0 0 8px 8px', marginTop: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#f0ede6' }}>Total labor cost</span>
                            <span style={{ fontSize: 16, fontWeight: 750, color: '#c9a84c', letterSpacing: '-0.4px' }}>{fmt(grandTotal, project.currency)}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Delete confirm */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
                    <div className="modal-box" style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3>Remove labor?</h3>
                            <button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={18} /></button>
                        </div>
                        <p style={{ color: '#6b6864', fontSize: 14, padding: '12px 0 20px', lineHeight: 1.6 }}>
                            Remove <strong style={{ color: '#1a1917' }}>{deleteTarget.resources?.name || deleteTarget.custom_name}</strong> from this project?
                        </p>
                        <div className="modal-actions">
                            <button className="btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
                            <button className="btn-danger" onClick={handleDelete} disabled={deleteLoading}>{deleteLoading ? 'Removing…' : 'Remove'}</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast ${toast.type === 'danger' ? 'toast-danger' : 'toast-success'}`}>{toast.msg}</div>}
        </div>
    )
}