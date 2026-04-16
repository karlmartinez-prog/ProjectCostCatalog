import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const EMPTY = {
    name: '', contact_email: '', phone: '',
    address: '', website: '', status: 'active', description: ''
}

export default function SupplierModal({ open, onClose, onSave, supplier }) {
    const [form, setForm] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (supplier) {
            setForm({
                name: supplier.name || '',
                contact_email: supplier.contact_email || '',
                phone: supplier.phone || '',
                address: supplier.address || '',
                website: supplier.website || '',
                status: supplier.status || 'active',
                description: supplier.description || '',
            })
        } else {
            setForm(EMPTY)
        }
        setError(null)
    }, [supplier, open])

    function set(field, value) {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.name.trim()) return setError('Supplier name is required.')
        setSaving(true)
        setError(null)
        try {
            const payload = {
                ...form,
                website: form.website || null,
                phone: form.phone || null,
                address: form.address || null,
                contact_email: form.contact_email || null,
                description: form.description || null,
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
                    <h3>{supplier ? 'Edit Supplier' : 'Add Supplier'}</h3>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="modal-grid-2">
                        <div className="mf-group" style={{ gridColumn: 'span 2' }}>
                            <label>Supplier name *</label>
                            <input
                                value={form.name}
                                onChange={e => set('name', e.target.value)}
                                placeholder="e.g. Santos Construction Supply"
                                required
                            />
                        </div>

                        <div className="mf-group">
                            <label>Contact email</label>
                            <input
                                type="email"
                                value={form.contact_email}
                                onChange={e => set('contact_email', e.target.value)}
                                placeholder="contact@supplier.com"
                            />
                        </div>

                        <div className="mf-group">
                            <label>Phone</label>
                            <input
                                value={form.phone}
                                onChange={e => set('phone', e.target.value)}
                                placeholder="+63 912 345 6789"
                            />
                        </div>

                        <div className="mf-group">
                            <label>Website</label>
                            <input
                                value={form.website}
                                onChange={e => set('website', e.target.value)}
                                placeholder="https://supplier.com"
                            />
                        </div>

                        <div className="mf-group">
                            <label>Status</label>
                            <select value={form.status} onChange={e => set('status', e.target.value)}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <div className="mf-group" style={{ gridColumn: 'span 2' }}>
                            <label>Address</label>
                            <input
                                value={form.address}
                                onChange={e => set('address', e.target.value)}
                                placeholder="123 Main St, Naga City, Camarines Sur"
                            />
                        </div>

                        <div className="mf-group" style={{ gridColumn: 'span 2' }}>
                            <label>Description</label>
                            <textarea
                                value={form.description}
                                onChange={e => set('description', e.target.value)}
                                placeholder="Brief description of this supplier — what they provide, any notes, terms, etc."
                                rows={3}
                            />
                        </div>
                    </div>

                    {error && <div className="modal-error">{error}</div>}

                    <div className="modal-actions">
                        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Saving…' : supplier ? 'Save changes' : 'Add supplier'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}