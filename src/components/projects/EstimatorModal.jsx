import { useState } from 'react'
import { X, Plus, Trash2, Calculator, Search, Package } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const DEFAULT_RATE = 6  // 6% annual inflation

function formatCost(amount, currency = 'PHP') {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency', currency,
        minimumFractionDigits: 2,
    }).format(amount || 0)
}

function adjustForInflation(cost, rate, years) {
    if (years <= 0) return cost
    return cost * Math.pow(1 + rate / 100, years)
}

// ── Inline resource search ───────────────────────────
function ResourcePicker({ onSelect }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)

    async function search(q) {
        if (!q.trim()) { setResults([]); return }
        setLoading(true)
        const { data } = await supabase
            .from('resources')
            .select('id, name, unit_cost, currency, unit')
            .ilike('name', `%${q}%`)
            .limit(6)
        setResults(data || [])
        setLoading(false)
    }

    function pick(r) {
        onSelect(r)
        setQuery('')
        setResults([])
        setOpen(false)
    }

    return (
        <div className="rp-wrap">
            <div className="rp-input-row">
                <Search size={14} strokeWidth={1.5} />
                <input
                    placeholder="Add from catalog…"
                    value={query}
                    onChange={e => { setQuery(e.target.value); search(e.target.value); setOpen(true) }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                />
            </div>
            {open && query.trim() && (
                <div className="rp-dropdown">
                    {loading && <div className="rp-hint">Searching…</div>}
                    {!loading && results.length === 0 && <div className="rp-hint">No results</div>}
                    {results.map(r => (
                        <button key={r.id} className="rp-result" onMouseDown={() => pick(r)}>
                            <Package size={13} strokeWidth={1.5} />
                            <span className="rp-result-name">{r.name}</span>
                            <span className="rp-result-cost">{formatCost(r.unit_cost, r.currency)}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function EstimatorModal({ open, onClose }) {
    const currentYear = new Date().getFullYear()
    const [targetYear, setTargetYear] = useState(currentYear + 3)
    const [inflationRate, setInflationRate] = useState(DEFAULT_RATE)
    const [currency, setCurrency] = useState('PHP')
    const [items, setItems] = useState([])

    function addFromCatalog(r) {
        setItems(prev => [...prev, {
            _id: Math.random().toString(36).slice(2),
            name: r.name,
            baseCost: r.unit_cost,
            quantity: 1,
            custom: false,
        }])
    }

    function addCustom() {
        setItems(prev => [...prev, {
            _id: Math.random().toString(36).slice(2),
            name: '',
            baseCost: '',
            quantity: 1,
            custom: true,
        }])
    }

    function update(id, field, val) {
        setItems(prev => prev.map(i => i._id === id ? { ...i, [field]: val } : i))
    }

    function remove(id) {
        setItems(prev => prev.filter(i => i._id !== id))
    }

    const years = Math.max(0, targetYear - currentYear)

    const rows = items.map(item => {
        const base = parseFloat(item.baseCost) || 0
        const qty = parseInt(item.quantity) || 1
        const adjusted = adjustForInflation(base, inflationRate, years)
        return { ...item, baseCost: base, quantity: qty, adjusted, subtotalBase: base * qty, subtotalAdj: adjusted * qty }
    })

    const totalBase = rows.reduce((s, r) => s + r.subtotalBase, 0)
    const totalAdj = rows.reduce((s, r) => s + r.subtotalAdj, 0)
    const increase = totalAdj - totalBase

    if (!open) return null

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box est-modal">
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Calculator size={18} strokeWidth={1.5} style={{ color: '#c9a84c' }} />
                        <h3>Future Cost Estimator</h3>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="modal-form">
                    {/* Settings row */}
                    <div className="est-settings">
                        <div className="mf-group">
                            <label>Target year</label>
                            <input
                                type="number"
                                min={currentYear}
                                max={currentYear + 50}
                                value={targetYear}
                                onChange={e => setTargetYear(parseInt(e.target.value))}
                            />
                        </div>
                        <div className="mf-group">
                            <label>Annual inflation rate (%)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={inflationRate}
                                onChange={e => setInflationRate(parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="mf-group">
                            <label>Currency</label>
                            <select value={currency} onChange={e => setCurrency(e.target.value)}>
                                {['PHP', 'USD', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="est-years-badge">
                        Projecting <strong>{years}</strong> year{years !== 1 ? 's' : ''} ahead at <strong>{inflationRate}%</strong> annual inflation
                    </div>

                    {/* Resource picker */}
                    <div className="mf-group">
                        <label>Add resources</label>
                        <ResourcePicker onSelect={addFromCatalog} />
                    </div>

                    <button type="button" className="proj-add-custom-btn" onClick={addCustom}>
                        <Plus size={14} strokeWidth={2} /> Add custom item
                    </button>

                    {/* Items table */}
                    {rows.length > 0 && (
                        <div className="proj-items-wrap">
                            <div className="proj-items-header">
                                <span style={{ flex: 3 }}>Item</span>
                                <span style={{ flex: 1.5 }}>Base cost ({currentYear})</span>
                                <span style={{ flex: 0.8 }}>Qty</span>
                                <span style={{ flex: 1.5 }}>Est. cost ({targetYear})</span>
                                <span style={{ flex: 1.2 }}>Est. subtotal</span>
                                <span style={{ width: 24 }}></span>
                            </div>

                            {rows.map(item => (
                                <div key={item._id} className="proj-item-row">
                                    <div style={{ flex: 3, minWidth: 0 }}>
                                        {item.custom ? (
                                            <input
                                                className="proj-item-input"
                                                value={item.name}
                                                onChange={e => update(item._id, 'name', e.target.value)}
                                                placeholder="Item name"
                                            />
                                        ) : (
                                            <div className="proj-item-name-fixed">
                                                <Package size={12} />
                                                <span>{item.name}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ flex: 1.5 }}>
                                        <input
                                            className="proj-item-input"
                                            type="number" min="0" step="0.01"
                                            value={item.baseCost}
                                            onChange={e => update(item._id, 'baseCost', e.target.value)}
                                            placeholder="0.00"
                                            readOnly={!item.custom}
                                            style={!item.custom ? { background: '#f9f8f5', color: '#7a7872' } : {}}
                                        />
                                    </div>

                                    <div style={{ flex: 0.8 }}>
                                        <input
                                            className="proj-item-input"
                                            type="number" min="1"
                                            value={item.quantity}
                                            onChange={e => update(item._id, 'quantity', e.target.value)}
                                        />
                                    </div>

                                    <div style={{ flex: 1.5 }} className="proj-item-subtotal est-adjusted">
                                        {formatCost(item.adjusted, currency)}
                                    </div>

                                    <div style={{ flex: 1.2 }} className="proj-item-subtotal">
                                        {formatCost(item.subtotalAdj, currency)}
                                    </div>

                                    <button type="button" className="rc-btn rc-btn-danger" style={{ flexShrink: 0 }} onClick={() => remove(item._id)}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}

                            {/* Results */}
                            <div className="est-results">
                                <div className="est-result-row">
                                    <span>Base total ({currentYear})</span>
                                    <span>{formatCost(totalBase, currency)}</span>
                                </div>
                                <div className="est-result-row est-result-adj">
                                    <span>Estimated total ({targetYear})</span>
                                    <span>{formatCost(totalAdj, currency)}</span>
                                </div>
                                {increase > 0 && (
                                    <div className="est-result-row est-result-increase">
                                        <span>Estimated increase</span>
                                        <span>+{formatCost(increase, currency)} ({((increase / totalBase) * 100).toFixed(1)}%)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {rows.length === 0 && (
                        <div className="rc-empty" style={{ padding: '32px 0' }}>
                            <div className="rc-empty-icon" style={{ fontSize: 28 }}>🧮</div>
                            <p style={{ fontSize: 14 }}>Add resources to estimate</p>
                            <span>Search from your catalog or add custom items above.</span>
                        </div>
                    )}

                    <div className="modal-actions">
                        <button className="btn-ghost" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    )
}