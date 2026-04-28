import { useState, useEffect } from 'react'
import { X, Upload, HardHat, Package, Wrench, MoreHorizontal } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { BILLING_TYPES } from '../../services/laborEngine'
import UnitComboField from '../ui/UnitComboField'

const STATUSES = ['active', 'pending', 'discontinued']
const RESOURCE_TYPES = ['Material', 'Labor', 'Equipment', 'Other']
const TRADES = [
    'Carpenter', 'Mason', 'Electrician', 'Plumber', 'Welder',
    'Painter', 'Laborer', 'Foreman', 'Engineer', 'Surveyor',
    'Operator', 'Tinsmith', 'Tile Setter', 'Steel Worker', 'Other',
]

const TYPE_ICONS = {
    Material: Package,
    Labor: HardHat,
    Equipment: Wrench,
    Other: MoreHorizontal,
}

const TYPE_COLORS = {
    Material: { bg: '#e8f0fe', color: '#1a56c4' },
    Labor: { bg: 'rgba(201,168,76,0.12)', color: '#8a6800' },
    Equipment: { bg: '#e6f4ea', color: '#2d7a3a' },
    Other: { bg: '#f4f3ef', color: '#6b6864' },
}

const EMPTY = {
    name: '', resource_type: 'Material', unit_cost: '', currency: 'PHP',
    unit: '', status: 'active', quantity: '', image_url: '',
    category_id: '', supplier_id: '', procured_at: '', trade: '', notes: '',
    billing_type: 'per_use',
}

export default function ResourceModal({ open, onClose, onSave, resource, categories, suppliers }) {
    const [form, setForm] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (resource) {
            setForm({
                name: resource.name || '',
                resource_type: resource.resource_type || 'Material',
                unit_cost: resource.unit_cost || '',
                currency: resource.currency || 'PHP',
                unit: resource.unit || '',
                status: resource.status || 'active',
                quantity: resource.quantity || '',
                image_url: resource.image_url || '',
                category_id: resource.category_id || '',
                supplier_id: resource.supplier_id || '',
                procured_at: resource.procured_at || '',
                trade: resource.trade || '',
                notes: resource.notes || '',
                billing_type: resource.billing_type || 'per_use',
            })
        } else {
            setForm(EMPTY)
        }
        setError(null)
    }, [resource, open])

    function set(field, value) {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    // When type changes, reset type-specific fields
    function setType(type) {
        setForm(prev => ({
            ...prev,
            resource_type: type,
            unit: type === 'Labor' ? 'day' : prev.unit,
        }))
    }

    const isLabor = form.resource_type === 'Labor'

    async function handleImageUpload(e) {
        const file = e.target.files[0]
        if (!file) return
        setUploading(true)
        const ext = file.name.split('.').pop()
        const path = `resources/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
            .from('resource-images').upload(path, file, { upsert: true })
        if (uploadError) {
            setError('Image upload failed: ' + uploadError.message)
        } else {
            const { data } = supabase.storage.from('resource-images').getPublicUrl(path)
            set('image_url', data.publicUrl)
        }
        setUploading(false)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.name.trim()) return setError('Name is required.')
        if (!form.unit_cost || isNaN(form.unit_cost)) return setError('Enter a valid cost.')
        setSaving(true)
        setError(null)
        try {
            const payload = {
                ...form,
                unit_cost: parseFloat(form.unit_cost),
                quantity: parseInt(form.quantity) || 0,
                category_id: form.category_id || null,
                supplier_id: form.supplier_id || null,
                procured_at: form.procured_at || null,
                trade: isLabor ? (form.trade || null) : null,
                notes: form.notes || null,
                billing_type: form.billing_type || 'per_use',
            }
            await onSave(payload)
            onClose()
        } catch (err) {
            setError(err.message)
        }
        setSaving(false)
    }

    if (!open) return null

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <h3>{resource ? 'Edit resource' : 'Add resource'}</h3>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">

                    {/* ── Type selector ── */}
                    <div className="mf-group">
                        <label>Resource type</label>
                        <div className="rm-type-picker">
                            {RESOURCE_TYPES.map(t => {
                                const Icon = TYPE_ICONS[t]
                                const colors = TYPE_COLORS[t]
                                const active = form.resource_type === t
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        className="rm-type-btn"
                                        style={active ? { background: colors.bg, borderColor: colors.color, color: colors.color } : {}}
                                        onClick={() => setType(t)}
                                    >
                                        <Icon size={14} strokeWidth={1.5} />
                                        {t}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* ── Image ── */}
                    <div className="modal-image-row">
                        <div className="modal-image-preview">
                            {form.image_url
                                ? <img src={form.image_url} alt="preview" />
                                : <div className="modal-image-empty"><Upload size={20} /></div>
                            }
                        </div>
                        <div>
                            <label className="upload-btn">
                                {uploading ? 'Uploading…' : 'Upload image'}
                                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                            </label>
                            <p className="modal-hint">Optional. JPG, PNG, WebP.</p>
                            {form.image_url && (
                                <button type="button" className="remove-img-btn" onClick={() => set('image_url', '')}>
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Name + status ── */}
                    <div className="modal-grid-2">
                        <div className="mf-group">
                            <label>Name *</label>
                            <input
                                value={form.name}
                                onChange={e => set('name', e.target.value)}
                                placeholder={isLabor ? 'e.g. Journeyman Carpenter' : 'e.g. Portland Cement'}
                                required autoFocus
                            />
                        </div>
                        <div className="mf-group">
                            <label>Status</label>
                            <select value={form.status} onChange={e => set('status', e.target.value)}>
                                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* ── Labor-specific: trade ── */}
                    {isLabor && (
                        <div className="mf-group">
                            <label>Trade</label>
                            <select value={form.trade} onChange={e => set('trade', e.target.value)}>
                                <option value="">— Select trade —</option>
                                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    )}

                    {/* ── Cost fields ── */}
                    <div className="modal-grid-3">
                        <div className="mf-group">
                            <label>{isLabor ? 'Salary' : 'Unit cost *'}</label>
                            <input
                                type="number" min="0" step="0.01"
                                value={form.unit_cost}
                                onChange={e => set('unit_cost', e.target.value)}
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div className="mf-group">
                            <label>Currency</label>
                            <select value={form.currency} onChange={e => set('currency', e.target.value)}>
                                {['PHP', 'USD', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="mf-group">
                            <label>Unit</label>
                            <UnitComboField
                                value={form.unit}
                                onChange={(unit, billing_type) => {
                                    setForm(prev => ({ ...prev, unit, billing_type }))
                                }}
                                placeholder={isLabor ? 'day' : 'e.g. per bag'}
                            />
                        </div>
                    </div>

                    {/* ── Non-labor: quantity + procured date ── */}
                    {!isLabor && (
                        <div className="modal-grid-2">
                            <div className="mf-group">
                                <label>Quantity in stock</label>
                                <input
                                    type="number" min="0"
                                    value={form.quantity}
                                    onChange={e => set('quantity', e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="mf-group">
                                <label>Date procured</label>
                                <input type="date" value={form.procured_at} onChange={e => set('procured_at', e.target.value)} />
                            </div>
                        </div>
                    )}

                    {/* ── Category + supplier ── */}
                    <div className="modal-grid-2">
                        <div className="mf-group">
                            <label>Category</label>
                            <select value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                                <option value="">— None —</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                                ))}
                            </select>
                        </div>
                        <div className="mf-group">
                            <label>Supplier</label>
                            <select value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}>
                                <option value="">— None —</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* ── Notes (labor) ── */}
                    {isLabor && (
                        <div className="mf-group">
                            <label>Notes <span style={{ color: '#aaa89f', fontWeight: 400 }}>(optional)</span></label>
                            <textarea
                                value={form.notes}
                                onChange={e => set('notes', e.target.value)}
                                placeholder="Skills, certifications, remarks…"
                                rows={2}
                            />
                        </div>
                    )}

                    {error && <div className="modal-error">{error}</div>}

                    <div className="modal-actions">
                        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Saving…' : resource ? 'Save changes' : 'Add resource'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}