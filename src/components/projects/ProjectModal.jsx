import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Search, Package } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const STATUSES = ['planned', 'ongoing', 'completed', 'cancelled']
const CAPEX_OPEX = ['CAPEX', 'OPEX']

const EMPTY_PROJECT = {
    name: '', description: '', status: 'planned',
    currency: 'PHP', start_date: '', end_date: '',
}

function formatCost(amount, currency = 'PHP') {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount)
}

// ── Resource search dropdown ─────────────────────────
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
            .select('id, name, unit_cost, currency, unit, categories(name, type)')
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
                    placeholder="Search catalog…"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true) }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                />
            </div>
            {open && (query.trim()) && (
                <div className="rp-dropdown">
                    {loading && <div className="rp-hint">Searching…</div>}
                    {!loading && results.length === 0 && <div className="rp-hint">No results for "{query}"</div>}
                    {results.map(r => (
                        <button key={r.id} className="rp-result" onMouseDown={() => pick(r)}>
                            <Package size={13} strokeWidth={1.5} />
                            <div className="rp-result-info">
                                <span className="rp-result-name">{r.name}</span>
                                {r.categories && <span className="rp-result-cat">{r.categories.name} · {r.categories.type}</span>}
                            </div>
                            <span className="rp-result-cost">{formatCost(r.unit_cost, r.currency)}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main modal ───────────────────────────────────────
export default function ProjectModal({ open, onClose, onSave, project, initialLineItems = [] }) {
    const [form, setForm] = useState(EMPTY_PROJECT)
    const [items, setItems] = useState([])    // line items
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [tab, setTab] = useState('info') // 'info' | 'resources'

    useEffect(() => {
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
                unit_cost_snapshot: li.unit_cost_snapshot,
                quantity: li.quantity,
                capex_opex: li.capex_opex || '',
                saveTocatalog: false,
                isCustom: !li.resource_id,
            })))
        } else {
            setForm(EMPTY_PROJECT)
            setItems([])
        }
        setError(null)
        setTab('info')
    }, [project, open])

    function setField(f, v) { setForm(prev => ({ ...prev, [f]: v })) }

    // Add from catalog
    function addFromCatalog(resource) {
        setItems(prev => [...prev, {
            _id: Math.random().toString(36).slice(2),
            resource_id: resource.id,
            name: resource.name,
            unit: resource.unit || '',
            unit_cost_snapshot: resource.unit_cost,
            quantity: 1,
            capex_opex: resource.categories?.type || '',
            saveTocatalog: false,
            isCustom: false,
        }])
    }

    // Add custom row
    function addCustomRow() {
        setItems(prev => [...prev, {
            _id: Math.random().toString(36).slice(2),
            resource_id: null,
            name: '',
            unit: '',
            unit_cost_snapshot: '',
            quantity: 1,
            capex_opex: '',
            saveTocatalog: false,
            isCustom: true,
        }])
    }

    function updateItem(id, field, value) {
        setItems(prev => prev.map(i => i._id === id ? { ...i, [field]: value } : i))
    }

    function removeItem(id) {
        setItems(prev => prev.filter(i => i._id !== id))
    }

    const total = items.reduce((sum, i) => {
        const cost = parseFloat(i.unit_cost_snapshot) || 0
        const qty = parseInt(i.quantity) || 0
        return sum + cost * qty
    }, 0)

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.name.trim()) { setError('Project name is required.'); setTab('info'); return }
        setSaving(true)
        setError(null)

        try {
            // Build catalog saves for custom items marked saveTocatalog
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
                    }])
                    .select('id')
                    .single()
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
                    _name: i.name,  // passed through for display
                    _unit: i.unit,
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
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box proj-modal-box">
                <div className="modal-header">
                    <h3>{project ? 'Edit Project' : 'New Project'}</h3>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Tabs */}
                <div className="proj-modal-tabs">
                    <button className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}>
                        Project info
                    </button>
                    <button className={tab === 'resources' ? 'active' : ''} onClick={() => setTab('resources')}>
                        Resources
                        {items.length > 0 && <span className="proj-tab-count">{items.length}</span>}
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* ── Tab: Info ── */}
                    {tab === 'info' && (
                        <div className="modal-form">
                            <div className="mf-group">
                                <label>Project name *</label>
                                <input
                                    value={form.name}
                                    onChange={e => setField('name', e.target.value)}
                                    placeholder="e.g. Naga City Road Widening Phase 2"
                                    required
                                />
                            </div>

                            <div className="mf-group">
                                <label>Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setField('description', e.target.value)}
                                    placeholder="Scope, objectives, notes about this project…"
                                    rows={3}
                                />
                            </div>

                            <div className="modal-grid-2">
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
                                <div className="mf-group">
                                    <label>Start date</label>
                                    <input type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
                                </div>
                                <div className="mf-group">
                                    <label>End date</label>
                                    <input type="date" value={form.end_date} onChange={e => setField('end_date', e.target.value)} />
                                </div>
                            </div>

                            <div className="proj-modal-next">
                                <button type="button" className="btn-primary" onClick={() => setTab('resources')}>
                                    Next: Add resources →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Tab: Resources ── */}
                    {tab === 'resources' && (
                        <div className="modal-form">
                            {/* Search catalog */}
                            <div className="mf-group">
                                <label>Search & add from catalog</label>
                                <ResourcePicker onSelect={addFromCatalog} />
                            </div>

                            <div className="proj-divider">
                                <span>or</span>
                            </div>

                            <button type="button" className="proj-add-custom-btn" onClick={addCustomRow}>
                                <Plus size={14} strokeWidth={2} /> Add custom resource
                            </button>

                            {/* Line items table */}
                            {items.length > 0 && (
                                <div className="proj-items-wrap">
                                    <div className="proj-items-header">
                                        <span style={{ flex: 3 }}>Resource</span>
                                        <span style={{ flex: 1.2 }}>Unit cost</span>
                                        <span style={{ flex: 0.8 }}>Qty</span>
                                        <span style={{ flex: 1 }}>Type</span>
                                        <span style={{ flex: 1 }}>Subtotal</span>
                                        <span style={{ width: 24 }}></span>
                                    </div>

                                    {items.map(item => (
                                        <div key={item._id} className="proj-item-row">
                                            <div style={{ flex: 3, minWidth: 0 }}>
                                                {item.isCustom ? (
                                                    <input
                                                        className="proj-item-input"
                                                        value={item.name}
                                                        onChange={e => updateItem(item._id, 'name', e.target.value)}
                                                        placeholder="Resource name"
                                                    />
                                                ) : (
                                                    <div className="proj-item-name-fixed">
                                                        <Package size={12} strokeWidth={1.5} />
                                                        <span>{item.name}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ flex: 1.2 }}>
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

                                            <div style={{ flex: 0.8 }}>
                                                <input
                                                    className="proj-item-input"
                                                    type="number" min="1"
                                                    value={item.quantity}
                                                    onChange={e => updateItem(item._id, 'quantity', e.target.value)}
                                                />
                                            </div>

                                            <div style={{ flex: 1 }}>
                                                <select
                                                    className="proj-item-input"
                                                    value={item.capex_opex}
                                                    onChange={e => updateItem(item._id, 'capex_opex', e.target.value)}
                                                >
                                                    <option value="">—</option>
                                                    {CAPEX_OPEX.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>

                                            <div style={{ flex: 1 }} className="proj-item-subtotal">
                                                {formatCost(
                                                    (parseFloat(item.unit_cost_snapshot) || 0) * (parseInt(item.quantity) || 0),
                                                    form.currency
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                className="rc-btn rc-btn-danger"
                                                style={{ flexShrink: 0 }}
                                                onClick={() => removeItem(item._id)}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Save-to-catalog checkboxes for custom items */}
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

                                    {/* Total */}
                                    <div className="proj-items-total">
                                        <span>Total project cost</span>
                                        <span>{formatCost(total, form.currency)}</span>
                                    </div>
                                </div>
                            )}

                            {error && <div className="modal-error">{error}</div>}

                            <div className="modal-actions">
                                <button type="button" className="btn-ghost" onClick={() => setTab('info')}>← Back</button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    )
}