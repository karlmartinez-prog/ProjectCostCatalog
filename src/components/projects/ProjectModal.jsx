import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Search, Package, Tag, HardHat, Calendar } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { countWorkingDays, resolveOpexDuration } from '../../services/laborEngine'
import UnitComboField from '../ui/UnitComboField'

const STATUSES = ['planned', 'ongoing', 'completed', 'cancelled']

const EMPTY_PROJECT = {
    name: '', description: '', status: 'planned',
    currency: 'PHP', start_date: '', end_date: '',
    working_days_mode: 'working_days',
}

function formatCost(amount, currency = 'PHP') {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency', currency,
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount || 0)
}

// ── Compute working/calendar days between two dates ──────
function computeDays(start, end, mode) {
    if (!start || !end) return 0
    if (mode === 'working_days') return countWorkingDays(start, end)
    const diff = new Date(end) - new Date(start)
    return Math.max(0, Math.round(diff / 86400000) + 1)
}

// ── Resolve the duration multiplier from unit + days ─────
// Works for BOTH labor and non-labor time-based units
function resolveDurationFromUnit(unit, workingDays) {
    const u = (unit || '').toLowerCase().trim()
    if (u === 'per day' || u === 'day') return workingDays
    if (u === 'per week' || u === 'week') return Math.ceil(workingDays / 5)
    if (u === 'per month' || u === 'month') return Math.ceil(workingDays / 22)
    return null // not time-based — use qty only
}

// ── Resource search dropdown ─────────────────────────────
function ResourcePicker({ onSelect }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)

    const search = useCallback(async (q) => {
        if (!q.trim()) { setResults([]); return }
        setLoading(true)
        const { data } = await supabase
            .from('resources')
            .select('id, name, unit_cost, currency, unit, image_url, resource_type, trade, billing_type, categories(id, name, type)')
            .ilike('name', `%${q}%`)
            .eq('status', 'active')
            .limit(8)
        setResults(data || [])
        setLoading(false)
    }, [])

    useEffect(() => {
        const t = setTimeout(() => search(query), 250)
        return () => clearTimeout(t)
    }, [query, search])

    function pick(resource) {
        onSelect(resource)
        setQuery('')
        setResults([])
        setOpen(false)
    }

    return (
        <div className="rp-wrap">
            <div className="rp-input-row">
                <Search size={14} strokeWidth={1.5} />
                <input
                    placeholder="Search resource catalog…"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true) }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                />
            </div>
            {open && query.trim() && (
                <div className="rp-dropdown">
                    {loading && <div className="rp-hint">Searching…</div>}
                    {!loading && results.length === 0 && (
                        <div className="rp-hint">No results for "{query}"</div>
                    )}
                    {results.map(r => (
                        <button key={r.id} className="rp-result" onMouseDown={() => pick(r)}>
                            <div className="rp-result-thumb">
                                {r.image_url
                                    ? <img src={r.image_url} alt={r.name} />
                                    : r.resource_type === 'Labor'
                                        ? <HardHat size={13} strokeWidth={1.5} style={{ color: '#c9a84c' }} />
                                        : <Package size={13} strokeWidth={1.5} />
                                }
                            </div>
                            <div className="rp-result-info">
                                <span className="rp-result-name">{r.name}</span>
                                <span className="rp-result-cat">
                                    {r.resource_type}
                                    {r.trade && ` · ${r.trade}`}
                                    {r.categories && (
                                        <span className={`rp-type-pill ${r.categories.type === 'CAPEX' ? 'capex' : 'opex'}`}>
                                            {r.categories.type}
                                        </span>
                                    )}
                                </span>
                            </div>
                            <span className="rp-result-cost">
                                {formatCost(r.unit_cost, r.currency)}
                                {r.unit && <span style={{ fontWeight: 400, fontSize: 11, color: '#aaa89f' }}> /{r.unit}</span>}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main modal ───────────────────────────────────────────
export default function ProjectModal({ open, onClose, onSave, project, initialLineItems = [] }) {
    const [form, setForm] = useState(EMPTY_PROJECT)
    const [items, setItems] = useState([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [categories, setCategories] = useState([])

    useEffect(() => {
        supabase.from('categories').select('id, name, type').order('name')
            .then(({ data }) => setCategories(data || []))
    }, [])

    useEffect(() => {
        if (!open) return
        if (project) {
            setForm({
                name: project.name || '',
                description: project.description || '',
                status: project.status || 'planned',
                currency: project.currency || 'PHP',
                start_date: project.start_date || '',
                end_date: project.end_date || '',
                working_days_mode: project.working_days_mode || 'working_days',
            })
            setItems(initialLineItems.map(li => ({
                _id: li.id || Math.random().toString(36).slice(2),
                resource_id: li.resource_id || null,
                name: li.resources?.name || li._name || '',
                unit: li.resources?.unit || li._unit || '',
                image_url: li.resources?.image_url || '',
                resource_type: li.resources?.resource_type || 'Material',
                trade: li.resources?.trade || '',
                unit_cost_snapshot: li.unit_cost_snapshot,
                quantity: li.quantity,
                working_days: li.working_days || null,
                labor_start_date: li.labor_start_date || '',
                labor_end_date: li.labor_end_date || '',
                category_id: li.resources?.categories?.id || li._category_id || '',
                category_name: li.resources?.categories?.name || li._category_name || '',
                category_type: li.resources?.categories?.type || li._category_type || '',
                capex_opex: li.capex_opex || li.resources?.categories?.type || '',
                billing_type: li.billing_type || 'per_use',
                saveTocatalog: false,
                isCustom: !li.resource_id,
                _overrideCat: false,
                _overrideDates: !!(li.labor_start_date || li.labor_end_date),
            })))
        } else {
            setForm(EMPTY_PROJECT)
            setItems([])
        }
        setError(null)
    }, [project, open])

    function setField(f, v) { setForm(prev => ({ ...prev, [f]: v })) }

    // Recompute working_days for time-based items whenever project dates or mode changes
    useEffect(() => {
        setItems(prev => prev.map(item => {
            // Only auto-update if not using manual date override
            if (item._overrideDates) return item
            const isTimeBased = resolveDurationFromUnit(item.unit, 1) !== null
            if (!isTimeBased) return item
            const days = computeDays(form.start_date, form.end_date, form.working_days_mode)
            return { ...item, working_days: days }
        }))
    }, [form.start_date, form.end_date, form.working_days_mode])

    function addFromCatalog(resource) {
        const isTimeBased = resolveDurationFromUnit(resource.unit, 1) !== null
        const days = isTimeBased
            ? computeDays(form.start_date, form.end_date, form.working_days_mode)
            : null

        setItems(prev => [...prev, {
            _id: Math.random().toString(36).slice(2),
            resource_id: resource.id,
            name: resource.name,
            // ✅ Always use the resource's actual unit — never override with 'day'
            unit: resource.unit || '',
            image_url: resource.image_url || '',
            resource_type: resource.resource_type || 'Material',
            trade: resource.trade || '',
            unit_cost_snapshot: resource.unit_cost,
            quantity: 1,
            working_days: days,
            labor_start_date: '',
            labor_end_date: '',
            category_id: resource.categories?.id || '',
            category_name: resource.categories?.name || '',
            category_type: resource.categories?.type || '',
            capex_opex: resource.categories?.type || '',
            billing_type: resource.billing_type || 'per_use',
            saveTocatalog: false,
            isCustom: false,
            _overrideCat: false,
            _overrideDates: false,
        }])
    }

    function addCustomRow() {
        setItems(prev => [...prev, {
            _id: Math.random().toString(36).slice(2),
            resource_id: null,
            name: '',
            unit: '',
            image_url: '',
            resource_type: 'Material',
            trade: '',
            unit_cost_snapshot: '',
            quantity: 1,
            working_days: null,
            labor_start_date: '',
            labor_end_date: '',
            category_id: '',
            category_name: '',
            category_type: '',
            capex_opex: '',
            billing_type: 'per_use',
            saveTocatalog: false,
            isCustom: true,
            _overrideCat: false,
            _overrideDates: false,
        }])
    }

    function updateItem(id, field, value) {
        setItems(prev => prev.map(i => {
            if (i._id !== id) return i

            if (field === 'category_id') {
                const cat = categories.find(c => c.id === value)
                return { ...i, category_id: value, category_name: cat?.name || '', category_type: cat?.type || '', capex_opex: cat?.type || '' }
            }

            // When unit changes, recompute working_days if time-based
            if (field === 'unit') {
                const isTimeBased = resolveDurationFromUnit(value, 1) !== null
                const days = isTimeBased
                    ? computeDays(
                        i._overrideDates ? i.labor_start_date : form.start_date,
                        i._overrideDates ? i.labor_end_date : form.end_date,
                        form.working_days_mode
                    )
                    : null
                return { ...i, unit: value, working_days: days }
            }

            if (field === 'labor_start_date' || field === 'labor_end_date') {
                const newItem = { ...i, [field]: value, _overrideDates: true }
                const start = field === 'labor_start_date' ? value : i.labor_start_date
                const end = field === 'labor_end_date' ? value : i.labor_end_date
                if (start && end) {
                    newItem.working_days = computeDays(start, end, form.working_days_mode)
                }
                return newItem
            }

            if (field === '_clearDateOverride') {
                const days = computeDays(form.start_date, form.end_date, form.working_days_mode)
                return { ...i, labor_start_date: '', labor_end_date: '', _overrideDates: false, working_days: days }
            }

            return { ...i, [field]: value }
        }))
    }

    function removeItem(id) {
        setItems(prev => prev.filter(i => i._id !== id))
    }

    // ── Unified subtotal — respects actual unit for ALL resource types ──
    function itemSubtotal(item) {
        const cost = parseFloat(item.unit_cost_snapshot) || 0
        const qty = parseInt(item.quantity) || 1
        const workingDays = item.working_days || 0

        // Resolve duration from the actual unit field
        const duration = resolveDurationFromUnit(item.unit, workingDays)

        if (duration !== null) {
            // Time-based: rate × qty × duration
            return cost * qty * duration
        }

        // Not time-based (lump sum, per unit, etc.)
        return cost * qty
    }

    const total = items.reduce((s, i) => s + itemSubtotal(i), 0)
    const capexTotal = items.filter(i => i.capex_opex === 'CAPEX').reduce((s, i) => s + itemSubtotal(i), 0)
    const opexTotal = items.filter(i => i.capex_opex === 'OPEX').reduce((s, i) => s + itemSubtotal(i), 0)
    const laborTotal = items.filter(i => i.resource_type === 'Labor').reduce((s, i) => s + itemSubtotal(i), 0)

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.name.trim()) return setError('Project name is required.')
        setSaving(true)
        setError(null)

        try {
            const savedMap = {}
            for (const item of items.filter(i => i.isCustom && i.saveTocatalog && i.name.trim())) {
                const { data } = await supabase
                    .from('resources')
                    .insert([{
                        name: item.name,
                        unit_cost: parseFloat(item.unit_cost_snapshot) || 0,
                        unit: item.unit || null,
                        status: 'active',
                        currency: form.currency,
                        resource_type: item.resource_type,
                        category_id: item.category_id || null,
                    }])
                    .select('id').maybeSingle()
                if (data) savedMap[item._id] = data.id
            }

            const projectPayload = {
                name: form.name.trim(),
                description: form.description || null,
                status: form.status,
                currency: form.currency,
                start_date: form.start_date || null,
                end_date: form.end_date || null,
                working_days_mode: form.working_days_mode,
                total_cost: total,
            }

            const lineItems = items
                .filter(i => i.name.trim() && parseFloat(i.unit_cost_snapshot) > 0)
                .map(i => ({
                    resource_id: savedMap[i._id] || i.resource_id || null,
                    quantity: parseInt(i.quantity) || 1,
                    unit_cost_snapshot: parseFloat(i.unit_cost_snapshot) || 0,
                    capex_opex: i.capex_opex || null,
                    billing_type: i.billing_type || 'per_use',
                    // ✅ Always persist working_days for any time-based item
                    working_days: i.working_days || null,
                    labor_start_date: i._overrideDates ? (i.labor_start_date || null) : null,
                    labor_end_date: i._overrideDates ? (i.labor_end_date || null) : null,
                    _name: i.name,
                    _unit: i.unit,
                    _resource_type: i.resource_type,
                    _category_id: i.category_id,
                    _category_name: i.category_name,
                    _category_type: i.category_type,
                }))

            await onSave(projectPayload, lineItems)
            onClose()
        } catch (err) {
            setError(err.message)
        }
        setSaving(false)
    }

    if (!open) return null

    return (
        <div className="pm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="pm-box">
                <div className="pm-header">
                    <h3>{project ? 'Edit project' : 'New project'}</h3>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className="pm-body">

                    {/* ── LEFT: Project info ── */}
                    <div className="pm-left">
                        <div className="pm-panel-title">Project info</div>

                        <div className="mf-group">
                            <label>Project name *</label>
                            <input value={form.name} onChange={e => setField('name', e.target.value)}
                                placeholder="e.g. Naga City Core Network Upgrade" required autoFocus />
                        </div>

                        <div className="mf-group">
                            <label>Description</label>
                            <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                                placeholder="Scope, objectives, notes…" rows={3} />
                        </div>

                        <div className="pm-form-row">
                            <div className="mf-group">
                                <label>Status</label>
                                <select value={form.status} onChange={e => setField('status', e.target.value)}>
                                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                </select>
                            </div>
                            <div className="mf-group">
                                <label>Currency</label>
                                <select value={form.currency} onChange={e => setField('currency', e.target.value)}>
                                    {['PHP', 'USD', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="pm-form-row">
                            <div className="mf-group">
                                <label>Start date</label>
                                <input type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
                            </div>
                            <div className="mf-group">
                                <label>End date</label>
                                <input type="date" value={form.end_date} onChange={e => setField('end_date', e.target.value)} />
                            </div>
                        </div>

                        <div className="mf-group">
                            <label>Day counting for labor</label>
                            <div className="pm-day-mode">
                                {[
                                    { value: 'working_days', label: 'Working days', hint: 'Excludes weekends & PH holidays' },
                                    { value: 'calendar_days', label: 'Calendar days', hint: 'All days including weekends' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        className={`pm-day-mode-btn ${form.working_days_mode === opt.value ? 'active' : ''}`}
                                        onClick={() => setField('working_days_mode', opt.value)}
                                    >
                                        <span className="pm-day-mode-label">{opt.label}</span>
                                        <span className="pm-day-mode-hint">{opt.hint}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pm-cost-summary">
                            <div className="pm-cost-row">
                                <span>Resources</span>
                                <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                            </div>
                            {laborTotal > 0 && (
                                <div className="pm-cost-row">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                                        <HardHat size={11} strokeWidth={1.5} style={{ color: '#c9a84c' }} /> Labor
                                    </span>
                                    <span>{formatCost(laborTotal, form.currency)}</span>
                                </div>
                            )}
                            {capexTotal > 0 && (
                                <div className="pm-cost-row">
                                    <span className="badge badge-blue" style={{ fontSize: 11 }}>CAPEX</span>
                                    <span>{formatCost(capexTotal, form.currency)}</span>
                                </div>
                            )}
                            {opexTotal > 0 && (
                                <div className="pm-cost-row">
                                    <span className="badge badge-purple" style={{ fontSize: 11 }}>OPEX</span>
                                    <span>{formatCost(opexTotal, form.currency)}</span>
                                </div>
                            )}
                            <div className="pm-cost-row pm-cost-total">
                                <span>Total cost</span>
                                <span>{formatCost(total, form.currency)}</span>
                            </div>
                        </div>

                        {error && <div className="modal-error">{error}</div>}

                        <div className="pm-actions">
                            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
                            </button>
                        </div>
                    </div>

                    {/* ── RIGHT: Resources ── */}
                    <div className="pm-right">
                        <div className="pm-panel-title">
                            Resources
                            {items.length > 0 && <span className="pm-resource-count">{items.length}</span>}
                        </div>

                        <ResourcePicker onSelect={addFromCatalog} />
                        <div className="proj-divider"><span>or</span></div>
                        <button type="button" className="proj-add-custom-btn" onClick={addCustomRow}>
                            <Plus size={14} strokeWidth={2} /> Add custom resource
                        </button>

                        {items.length === 0 ? (
                            <div className="pm-empty-resources">
                                <Package size={28} strokeWidth={1} />
                                <p>No resources added yet</p>
                                <span>Search the catalog above or add a custom item.</span>
                            </div>
                        ) : (
                            <div className="pm-items-list">
                                {items.map(item => {
                                    const isLabor = item.resource_type === 'Labor'
                                    const workingDays = item.working_days || 0
                                    const duration = resolveDurationFromUnit(item.unit, workingDays)
                                    const isTimeBased = duration !== null
                                    const subtotal = itemSubtotal(item)
                                    const hasProject = !!(form.start_date && form.end_date)

                                    // Human-readable duration label for formula preview
                                    const unitNorm = (item.unit || '').toLowerCase().trim()
                                    const durationWord = unitNorm === 'per week' || unitNorm === 'week'
                                        ? 'week' : unitNorm === 'per month' || unitNorm === 'month'
                                            ? 'month' : 'day'

                                    return (
                                        <div key={item._id} className={`pm-item-card ${isLabor ? 'pm-item-labor' : ''}`}>

                                            {/* Row 1: thumb + name + type badge + delete */}
                                            <div className="pm-item-top">
                                                <div className="pm-item-thumb">
                                                    {item.image_url
                                                        ? <img src={item.image_url} alt={item.name} />
                                                        : isLabor
                                                            ? <HardHat size={13} strokeWidth={1.5} style={{ color: '#c9a84c' }} />
                                                            : <Package size={13} strokeWidth={1.5} />
                                                    }
                                                </div>
                                                <div className="pm-item-name-wrap">
                                                    {item.isCustom ? (
                                                        <input className="proj-item-input" value={item.name}
                                                            onChange={e => updateItem(item._id, 'name', e.target.value)}
                                                            placeholder="Resource name" />
                                                    ) : (
                                                        <div className="pm-item-name-fixed">
                                                            <span>{item.name}</span>
                                                            {item.trade && <span className="pm-item-unit">· {item.trade}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                                {isLabor && (
                                                    <span className="pm-labor-tag">
                                                        <HardHat size={10} strokeWidth={2} /> Labor
                                                    </span>
                                                )}
                                                <button type="button" className="rc-btn rc-btn-danger"
                                                    onClick={() => removeItem(item._id)} style={{ flexShrink: 0 }}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>

                                            {/* Row 2: cost fields */}
                                            <div className="pm-item-fields">
                                                <div className="pm-item-field">
                                                    <label>{isLabor ? 'Rate' : 'Unit cost'}</label>
                                                    <input className="proj-item-input"
                                                        type="number" min="0" step="0.01"
                                                        value={item.unit_cost_snapshot}
                                                        onChange={e => updateItem(item._id, 'unit_cost_snapshot', e.target.value)}
                                                        placeholder="0.00"
                                                        readOnly={!item.isCustom}
                                                        style={!item.isCustom ? { background: '#f9f8f5', color: '#7a7872' } : {}}
                                                    />
                                                </div>

                                                <div className="pm-item-field">
                                                    <label>{isLabor ? 'Workers' : 'Qty'}</label>
                                                    <input className="proj-item-input" type="number" min="1"
                                                        value={item.quantity}
                                                        onChange={e => updateItem(item._id, 'quantity', e.target.value)} />
                                                </div>

                                                <div className="pm-item-field" style={{ flex: 2 }}>
                                                    <label>Category</label>
                                                    {!item.isCustom && item.category_name && !item._overrideCat ? (
                                                        <div className="pm-cat-display">
                                                            <span className={`badge ${item.category_type === 'CAPEX' ? 'badge-blue' : item.category_type === 'OPEX' ? 'badge-purple' : 'badge-gray'}`}>
                                                                {item.category_name}
                                                            </span>
                                                            <button type="button" className="pm-cat-override"
                                                                onClick={() => updateItem(item._id, '_overrideCat', true)} title="Override">
                                                                <Tag size={11} strokeWidth={1.5} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <select className="proj-item-input"
                                                            value={item.category_id}
                                                            onChange={e => updateItem(item._id, 'category_id', e.target.value)}>
                                                            <option value="">— None —</option>
                                                            {categories.map(c => (
                                                                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>

                                                {/* Unit field — always shown, editable for custom items */}
                                                <div className="pm-item-field">
                                                    <label>Unit</label>
                                                    {item.isCustom ? (
                                                        <UnitComboField
                                                            value={item.unit || ''}
                                                            onChange={(unit, billing_type) => {
                                                                setItems(prev => prev.map(i =>
                                                                    i._id === item._id ? { ...i, unit, billing_type } : i
                                                                ))
                                                                // Also recompute working_days if time-based
                                                                updateItem(item._id, 'unit', unit)
                                                            }}
                                                            placeholder="e.g. per month"
                                                        />
                                                    ) : (
                                                        // Read-only display of the resource's actual unit
                                                        <div style={{
                                                            padding: '7px 10px',
                                                            background: '#f9f8f5',
                                                            borderRadius: 6,
                                                            fontSize: 13,
                                                            color: '#7a7872',
                                                            border: '1px solid #e8e5e0',
                                                        }}>
                                                            {item.unit || '—'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Row 3: Date override row — shown for ANY time-based item */}
                                            {isTimeBased && (
                                                <div className="pm-labor-days-row">
                                                    <div className="pm-labor-days-info">
                                                        <Calendar size={12} strokeWidth={1.5} />
                                                        {item._overrideDates ? (
                                                            <span className="pm-labor-override-label">Custom dates</span>
                                                        ) : hasProject ? (
                                                            <span>
                                                                {duration} {durationWord}{duration !== 1 ? 's' : ''}
                                                                <span style={{ color: '#aaa89f', marginLeft: 4 }}>
                                                                    ({workingDays} days)
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: '#f08c00' }}>Set project dates to auto-calculate</span>
                                                        )}
                                                    </div>
                                                    {!item._overrideDates ? (
                                                        <button type="button" className="pm-labor-override-btn"
                                                            onClick={() => updateItem(item._id, '_overrideDates', true)}>
                                                            Override dates
                                                        </button>
                                                    ) : (
                                                        <button type="button" className="pm-labor-override-btn pm-labor-override-clear"
                                                            onClick={() => updateItem(item._id, '_clearDateOverride', true)}>
                                                            Use project dates
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Date override inputs */}
                                            {isTimeBased && item._overrideDates && (
                                                <div className="pm-item-fields" style={{ paddingTop: 0 }}>
                                                    <div className="pm-item-field">
                                                        <label>Start</label>
                                                        <input className="proj-item-input" type="date"
                                                            value={item.labor_start_date}
                                                            onChange={e => updateItem(item._id, 'labor_start_date', e.target.value)} />
                                                    </div>
                                                    <div className="pm-item-field">
                                                        <label>End</label>
                                                        <input className="proj-item-input" type="date"
                                                            value={item.labor_end_date}
                                                            onChange={e => updateItem(item._id, 'labor_end_date', e.target.value)} />
                                                    </div>
                                                    <div className="pm-item-field" style={{ justifyContent: 'flex-end' }}>
                                                        <label>&nbsp;</label>
                                                        <div style={{ fontSize: 12, color: '#c9a84c', fontWeight: 600, padding: '8px 4px' }}>
                                                            {workingDays} days
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Formula preview — unified for all time-based resources */}
                                            {isTimeBased && parseFloat(item.unit_cost_snapshot) > 0 && duration > 0 && (
                                                <div className={`pm-labor-formula ${!isLabor ? 'style="background: rgba(139,92,246,0.06); border-top-color: rgba(139,92,246,0.15)"' : ''}`}
                                                    style={!isLabor ? { background: 'rgba(139,92,246,0.06)', borderTopColor: 'rgba(139,92,246,0.15)' } : {}}>
                                                    {formatCost(parseFloat(item.unit_cost_snapshot), form.currency)}/{durationWord}
                                                    × {item.quantity || 1} {isLabor ? `worker${(item.quantity || 1) > 1 ? 's' : ''}` : `unit${(item.quantity || 1) > 1 ? 's' : ''}`}
                                                    × {duration} {durationWord}{duration !== 1 ? 's' : ''}
                                                    = <strong>{formatCost(subtotal, form.currency)}</strong>
                                                </div>
                                            )}

                                            {/* Subtotal row */}
                                            <div className="pm-item-subtotal-row">
                                                <span className="pm-item-subtotal-label">Subtotal</span>
                                                <span className="pm-item-subtotal-value">{formatCost(subtotal, form.currency)}</span>
                                            </div>
                                        </div>
                                    )
                                })}

                                {items.some(i => i.isCustom && i.name.trim()) && (
                                    <div className="proj-save-catalog-section">
                                        <p className="proj-save-catalog-label">Save custom resources to catalog?</p>
                                        {items.filter(i => i.isCustom && i.name.trim()).map(item => (
                                            <label key={item._id} className="proj-save-catalog-row">
                                                <input type="checkbox" checked={item.saveTocatalog}
                                                    onChange={e => updateItem(item._id, 'saveTocatalog', e.target.checked)} />
                                                <span>"{item.name}"</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}