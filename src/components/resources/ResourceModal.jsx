import { useState, useEffect } from 'react'
import { X, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const STATUSES = ['active', 'pending', 'discontinued']
const EMPTY = {
    name: '', unit_cost: '', currency: 'PHP', unit: '',
    status: 'active', quantity: '', image_url: '',
    category_id: '', supplier_id: '', procured_at: ''
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
                unit_cost: resource.unit_cost || '',
                currency: resource.currency || 'PHP',
                unit: resource.unit || '',
                status: resource.status || 'active',
                quantity: resource.quantity || '',
                image_url: resource.image_url || '',
                category_id: resource.category_id || '',
                supplier_id: resource.supplier_id || '',
                procured_at: resource.procured_at || '',
            })
        } else {
            setForm(EMPTY)
        }
        setError(null)
    }, [resource, open])

    function set(field, value) {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    async function handleImageUpload(e) {
        const file = e.target.files[0]
        if (!file) return
        setUploading(true)
        const ext = file.name.split('.').pop()
        const path = `resources/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
            .from('resource-images')
            .upload(path, file, { upsert: true })
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
                    <h3>{resource ? 'Edit Resource' : 'Add Resource'}</h3>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">
                    {/* Image */}
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

                    <div className="modal-grid-2">
                        <div className="mf-group">
                            <label>Resource name *</label>
                            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Portland Cement" required />
                        </div>
                        <div className="mf-group">
                            <label>Status</label>
                            <select value={form.status} onChange={e => set('status', e.target.value)}>
                                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="modal-grid-3">
                        <div className="mf-group">
                            <label>Unit cost *</label>
                            <input type="number" min="0" step="0.01" value={form.unit_cost}
                                onChange={e => set('unit_cost', e.target.value)} placeholder="0.00" required />
                        </div>
                        <div className="mf-group">
                            <label>Currency</label>
                            <select value={form.currency} onChange={e => set('currency', e.target.value)}>
                                {['PHP', 'USD', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="mf-group">
                            <label>Unit</label>
                            <input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="per bag, per kg…" />
                        </div>
                    </div>

                    <div className="modal-grid-2">
                        <div className="mf-group">
                            <label>Quantity in stock</label>
                            <input type="number" min="0" value={form.quantity}
                                onChange={e => set('quantity', e.target.value)} placeholder="0" />
                        </div>
                        <div className="mf-group">
                            <label>Date procured</label>
                            <input type="date" value={form.procured_at}
                                onChange={e => set('procured_at', e.target.value)} />
                        </div>
                    </div>

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