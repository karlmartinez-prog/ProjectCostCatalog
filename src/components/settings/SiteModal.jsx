import { useState, useEffect } from 'react'
import { X, Check, Loader } from 'lucide-react'

export default function SiteModal({ open, onClose, onSave, site }) {
    const [form, setForm] = useState({ name: '', code: '', address: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!open) return
        setForm(site
            ? { name: site.name || '', code: site.code || '', address: site.address || '' }
            : { name: '', code: '', address: '' }
        )
        setError(null)
    }, [site, open])

    function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.name.trim()) return setError('Site name is required.')
        setSaving(true)
        setError(null)
        try {
            await onSave({
                name: form.name.trim(),
                code: form.code.trim() || null,
                address: form.address.trim() || null,
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
                    <h3>{site ? 'Edit site' : 'Add site'}</h3>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '16px 0 0' }}>
                    <div className="mf-group">
                        <label>Site name *</label>
                        <input
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            placeholder="e.g. Naga City Node Site"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="mf-group">
                        <label>Site code <span style={{ color: '#aaa89f', fontWeight: 400 }}>(optional)</span></label>
                        <input
                            value={form.code}
                            onChange={e => set('code', e.target.value)}
                            placeholder="e.g. NGC-01"
                        />
                        <span style={{ fontSize: 11.5, color: '#aaa89f', marginTop: 3 }}>
                            Short identifier shown on project cards and detail views.
                        </span>
                    </div>

                    <div className="mf-group">
                        <label>Address <span style={{ color: '#aaa89f', fontWeight: 400 }}>(optional)</span></label>
                        <textarea
                            value={form.address}
                            onChange={e => set('address', e.target.value)}
                            placeholder="e.g. Brgy. Triangulo, Naga City, Camarines Sur"
                            rows={2}
                        />
                    </div>

                    {error && <div className="modal-error">{error}</div>}

                    <div className="modal-actions">
                        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving
                                ? <><Loader size={13} className="st-spin" /> Saving…</>
                                : <><Check size={13} /> {site ? 'Save changes' : 'Add site'}</>
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}