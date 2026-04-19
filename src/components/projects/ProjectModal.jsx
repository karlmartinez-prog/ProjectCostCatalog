import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Search, Package, Tag } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const STATUSES = ['planned', 'ongoing', 'completed', 'cancelled']

const EMPTY_PROJECT = {
    name: '', description: '', status: 'planned',
    currency: 'PHP', start_date: '', end_date: '',
}

function formatCost(amount, currency = 'PHP') {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency', currency,
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount || 0)
}

// ── Resource search dropdown ──────────────────────────
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
            .select('id, name, unit_cost, currency, unit, image_url, categories(id, name, type)')
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
                                    : <Package size={13} strokeWidth={1.5} />
                                }
                            </div>
                            <div className="rp-result-info">
                                <span className="rp-result-name">{r.name}</span>
                                {r.categories && (
                                    <span className="rp-result-cat">
                                        {r.categories.name}
                                        <span className={`rp-type-pill ${r.categories.type === 'CAPEX' ? 'capex' : 'opex'}`}>
                                            {r.categories.type}
                                        </span>
                                    </span>
                                )}
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

// ── Main modal ────────────────────────────────────────
export default function ProjectModal({ open, onClose, onSave, project, initialLineItems = [] }) {
    const [form, setForm] = useState(EMPTY_PROJECT)
    const [items, setItems] = useState([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [categories, setCategories] = useState([])

    // Load categories once
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
            })
            setItems(initialLineItems.map(li => ({
                _id: li.id || Math.random().toString(36).slice(2),
                resource_id: li.resource_id || null,
                name: li.resources?.name || li._name || '',
                unit: li.resources?.unit || li._unit || '',
                image_url: li.resources?.image_url || '',
                unit_cost_snapshot: li.unit_cost_snapshot,
                quantity: li.quantity,
                category_id: li.resources?.categories?.id || li._category_id || '',
                category_name: li.resources?.categories?.name || li._category_name || '',
                category_type: li.resources?.categories?.type || li._category_type || '',
                capex_opex: li.capex_opex || li.resources?.categories?.type || '',
                saveTocatalog: false,
                isCustom: !li.resource_id,
            })))
        } else {
            setForm(EMPTY_PROJECT)
            setItems([])
        }
        setError(null)
    }, [project, open])

    function setField(f, v) { setForm(prev => ({ ...prev, [f]: v })) }

    function addFromCatalog(resource) {
        setItems(prev => [...prev, {
            _id: Math.random().toString(36).slice(2),
            resource_id: resource.id,
            name: resource.name,
            unit: resource.unit || '',
            image_url: resource.image_url || '',
            unit_cost_snapshot: resource.unit_cost,
            quantity: 1,
            category_id: resource.categories?.id || '',
            category_name: resource.categories?.name || '',
            category_type: resource.categories?.type || '',
            capex_opex: resource.categories?.type || '',
            saveTocatalog: false,
            isCustom: false,
        }])
    }

    function addCustomRow() {
        setItems(prev => [...prev, {
            _id: Math.random().toString(36).slice(2),
            resource_id: null,
            name: '',
            unit: '',
            image_url: '',
            unit_cost_snapshot: '',
            quantity: 1,
            category_id: '',
            category_name: '',
            category_type: '',
            capex_opex: '',
            saveTocatalog: false,
            isCustom: true,
        }])
    }

    function updateItem(id, field, value) {
        setItems(prev => prev.map(i => {
            if (i._id !== id) return i
            // When category changes, also update capex_opex
            if (field === 'category_id') {
                const cat = categories.find(c => c.id === value)
                return {
                    ...i,
                    category_id: value,
                    category_name: cat?.name || '',
                    category_type: cat?.type || '',
                    capex_opex: cat?.type || '',
                }
            }
            return { ...i, [field]: value }
        }))
    }

    function removeItem(id) {
        setItems(prev => prev.filter(i => i._id !== id))
    }

    const total = items.reduce((sum, i) => {
        return sum + (parseFloat(i.unit_cost_snapshot) || 0) * (parseInt(i.quantity) || 0)
    }, 0)

    const capexTotal = items
        .filter(i => i.capex_opex === 'CAPEX')
        .reduce((s, i) => s + (parseFloat(i.unit_cost_snapshot) || 0) * (parseInt(i.quantity) || 0), 0)

    const opexTotal = items
        .filter(i => i.capex_opex === 'OPEX')
        .reduce((s, i) => s + (parseFloat(i.unit_cost_snapshot) || 0) * (parseInt(i.quantity) || 0), 0)

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.name.trim()) return setError('Project name is required.')
        setSaving(true)
        setError(null)

        try {
            // Save custom resources to catalog if checked
            const customToSave = items.filter(i => i.isCustom && i.saveTocatalog && i.name.trim())
            const savedMap = {}
            for (const item of customToSave) {
                const { data } = await supabase
                    .from('resources')
                    .insert([{
                        name: item.name,
                        unit_cost: parseFloat(item.unit_cost_snapshot) || 0,
                        unit: item.unit || null,
                        status: 'active',
                        currency: form.currency,
                        category_id: item.category_id || null,
                    }])
                    .select('id')
                    .maybeSingle()
                if (data) savedMap[item._id] = data.id
            }

            const projectPayload = {
                name: form.name.trim(),
                description: form.description || null,
                status: form.status,
                currency: form.currency,
                start_date: form.start_date || null,
                end_date: form.end_date || null,
                total_cost: total,
            }

            const lineItems = items
                .filter(i => i.name.trim() && parseFloat(i.unit_cost_snapshot) > 0)
                .map(i => ({
                    resource_id: savedMap[i._id] || i.resource_id || null,
                    quantity: parseInt(i.quantity) || 1,
                    unit_cost_snapshot: parseFloat(i.unit_cost_snapshot) || 0,
                    capex_opex: i.capex_opex || null,
                    _name: i.name,
                    _unit: i.unit,
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
                {/* ── Header ── */}
                <div className="pm-header">
                    <h3>{project ? 'Edit project' : 'New project'}</h3>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className="pm-body">

                    {/* ── LEFT PANEL: Project info ── */}
                    <div className="pm-left">
                        <div className="pm-panel-title">Project info</div>

                        <div className="mf-group">
                            <label>Project name *</label>
                            <input
                                value={form.name}
                                onChange={e => setField('name', e.target.value)}
                                placeholder="e.g. Naga City Road Widening Phase 2"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="mf-group">
                            <label>Description</label>
                            <textarea
                                value={form.description}
                                onChange={e => setField('description', e.target.value)}
                                placeholder="Scope, objectives, notes…"
                                rows={4}
                            />
                        </div>

                        <div className="pm-form-row">
                            <div className="mf-group">
                                <label>Status</label>
                                <select value={form.status} onChange={e => setField('status', e.target.value)}>
                                    {STATUSES.map(s => (
                                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                    ))}
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

                        {/* Cost summary at the bottom of the left panel */}
                        <div className="pm-cost-summary">
                            <div className="pm-cost-row">
                                <span>Resources</span>
                                <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                            </div>
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

                    {/* ── RIGHT PANEL: Resources ── */}
                    <div className="pm-right">
                        <div className="pm-panel-title">
                            Resources
                            {items.length > 0 && (
                                <span className="pm-resource-count">{items.length}</span>
                            )}
                        </div>

                        {/* Search */}
                        <ResourcePicker onSelect={addFromCatalog} />

                        <div className="proj-divider"><span>or</span></div>

                        <button type="button" className="proj-add-custom-btn" onClick={addCustomRow}>
                            <Plus size={14} strokeWidth={2} /> Add custom resource
                        </button>

                        {/* Items list */}
                        {items.length === 0 ? (
                            <div className="pm-empty-resources">
                                <Package size={28} strokeWidth={1} />
                                <p>No resources added yet</p>
                                <span>Search the catalog above or add a custom item.</span>
                            </div>
                        ) : (
                            <div className="pm-items-list">
                                {items.map(item => (
                                    <div key={item._id} className="pm-item-card">
                                        {/* Row 1: thumb + name + delete */}
                                        <div className="pm-item-top">
                                            <div className="pm-item-thumb">
                                                {item.image_url
                                                    ? <img src={item.image_url} alt={item.name} />
                                                    : <Package size={13} strokeWidth={1.5} />
                                                }
                                            </div>
                                            <div className="pm-item-name-wrap">
                                                {item.isCustom ? (
                                                    <input
                                                        className="proj-item-input"
                                                        value={item.name}
                                                        onChange={e => updateItem(item._id, 'name', e.target.value)}
                                                        placeholder="Resource name"
                                                    />
                                                ) : (
                                                    <div className="pm-item-name-fixed">
                                                        <span>{item.name}</span>
                                                        {item.unit && <span className="pm-item-unit">/{item.unit}</span>}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="rc-btn rc-btn-danger"
                                                onClick={() => removeItem(item._id)}
                                                style={{ flexShrink: 0 }}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>

                                        {/* Row 2: cost, qty, category */}
                                        <div className="pm-item-fields">
                                            <div className="pm-item-field">
                                                <label>Unit cost</label>
                                                <input
                                                    className="proj-item-input"
                                                    type="number" min="0" step="0.01"
                                                    value={item.unit_cost_snapshot}
                                                    onChange={e => updateItem(item._id, 'unit_cost_snapshot', e.target.value)}
                                                    placeholder="0.00"
                                                    readOnly={!item.isCustom}
                                                    style={!item.isCustom ? { background: '#f9f8f5', color: '#7a7872' } : {}}
                                                />
                                            </div>

                                            <div className="pm-item-field">
                                                <label>Qty</label>
                                                <input
                                                    className="proj-item-input"
                                                    type="number" min="1"
                                                    value={item.quantity}
                                                    onChange={e => updateItem(item._id, 'quantity', e.target.value)}
                                                />
                                            </div>

                                            <div className="pm-item-field" style={{ flex: 2 }}>
                                                <label>Category</label>
                                                {!item.isCustom && item.category_name ? (
                                                    // Catalog resource — show with override option
                                                    <div className="pm-cat-display">
                                                        <span className={`badge ${item.category_type === 'CAPEX' ? 'badge-blue' : item.category_type === 'OPEX' ? 'badge-purple' : 'badge-gray'}`}>
                                                            {item.category_name || '—'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="pm-cat-override"
                                                            onClick={() => updateItem(item._id, '_overrideCat', true)}
                                                            title="Override category"
                                                        >
                                                            <Tag size={11} strokeWidth={1.5} />
                                                        </button>
                                                        {item._overrideCat && (
                                                            <select
                                                                className="proj-item-input"
                                                                value={item.category_id}
                                                                onChange={e => updateItem(item._id, 'category_id', e.target.value)}
                                                            >
                                                                <option value="">— None —</option>
                                                                {categories.map(c => (
                                                                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                ) : (
                                                    // Custom resource — always show dropdown
                                                    <select
                                                        className="proj-item-input"
                                                        value={item.category_id}
                                                        onChange={e => updateItem(item._id, 'category_id', e.target.value)}
                                                    >
                                                        <option value="">— None —</option>
                                                        {categories.map(c => (
                                                            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        </div>

                                        {/* Row 3: subtotal */}
                                        <div className="pm-item-subtotal-row">
                                            <span className="pm-item-subtotal-label">Subtotal</span>
                                            <span className="pm-item-subtotal-value">
                                                {formatCost(
                                                    (parseFloat(item.unit_cost_snapshot) || 0) * (parseInt(item.quantity) || 0),
                                                    form.currency
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {/* Save-to-catalog checkboxes */}
                                {items.some(i => i.isCustom && i.name.trim()) && (
                                    <div className="proj-save-catalog-section">
                                        <p className="proj-save-catalog-label">Save custom resources to catalog?</p>
                                        {items.filter(i => i.isCustom && i.name.trim()).map(item => (
                                            <label key={item._id} className="proj-save-catalog-row">
                                                <input
                                                    type="checkbox"
                                                    checked={item.saveTocatalog}
                                                    onChange={e => updateItem(item._id, 'saveTocatalog', e.target.checked)}
                                                />
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