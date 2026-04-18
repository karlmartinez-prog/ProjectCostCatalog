import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const EMPTY = { name: '', type: 'CAPEX', description: '' }

const TYPE_OPTIONS = ['CAPEX', 'OPEX']

export default function CategoryModal({ open, onClose, onSave, category }) {
    const [form, setForm] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (category) {
            setForm({
                name: category.name || '',
                type: category.type || 'CAPEX',
                description: category.description || '',
            })
        } else {
            setForm(EMPTY)
        }
        setError(null)
    }, [category, open])

    function set(field, value) {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.name.trim()) return setError('Category name is required.')
        setSaving(true)
        setError(null)
        try {
            await onSave({
                name: form.name.trim(),
                type: form.type,
                description: form.description || null,
            })
            onClose()
        } catch (err) {
            setError(err.message)
        }
        setSaving(false)
    }

    if (!open) return null

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 440 }}>
                <div className="modal-header">
                    <h3>{category ? 'Edit category' : 'Add category'}</h3>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="mf-group">
                        <label>Category name *</label>
                        <input
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            placeholder="e.g. Civil Works"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="mf-group">
                        <label>Type</label>
                        <div className="st-type-picker">
                            {TYPE_OPTIONS.map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    className={`st-type-btn ${form.type === t ? 'active' : ''} ${t === 'CAPEX' ? 'capex' : 'opex'}`}
                                    onClick={() => set('type', t)}
                                >
                                    {t}
                                    <span className="st-type-hint">
                                        {t === 'CAPEX' ? 'Capital expenditure' : 'Operating expenditure'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mf-group">
                        <label>Description <span style={{ color: '#aaa89f', fontWeight: 400 }}>(optional)</span></label>
                        <textarea
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            placeholder="Brief description of this category…"
                            rows={2}
                        />
                    </div>

                    {error && <div className="modal-error">{error}</div>}

                    <div className="modal-actions">
                        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Saving…' : category ? 'Save changes' : 'Add category'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}