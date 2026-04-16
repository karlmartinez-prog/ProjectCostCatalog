import { useState } from 'react'
import { Plus, Search, X, Pencil, Trash2, AlertTriangle, Mail, Phone, MapPin, Boxes } from 'lucide-react'
import { useSuppliers } from '../hooks/useSuppliers'
import SupplierModal from '../components/suppliers/SupplierModal'
import SupplierDrawer from '../components/suppliers/SupplierDrawer'
import '../components/suppliers/suppliers.css'

export default function Suppliers() {
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [selectedId, setSelectedId] = useState(null)
    const [toast, setToast] = useState(null)

    const { suppliers, loading, error, createSupplier, updateSupplier, deleteSupplier } = useSuppliers(search)

    function showToast(msg, type = 'success') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    function openAdd() { setEditing(null); setModalOpen(true) }
    function openEdit(s) { setEditing(s); setModalOpen(true) }

    async function handleSave(payload) {
        if (editing) {
            await updateSupplier(editing.id, payload)
            showToast('Supplier updated.')
        } else {
            await createSupplier(payload)
            showToast('Supplier added.')
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return
        setDeleteLoading(true)
        try {
            await deleteSupplier(deleteTarget.id)
            if (selectedId === deleteTarget.id) setSelectedId(null)
            showToast('Supplier deleted.', 'danger')
        } catch (e) {
            showToast(e.message, 'danger')
        }
        setDeleteLoading(false)
        setDeleteTarget(null)
    }

    return (
        <div className="sp-page">
            {/* ── Header ── */}
            <div className="page-header">
                <div className="page-header-text">
                    <h2>Suppliers</h2>
                    <p>{loading ? 'Loading…' : `${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}`}</p>
                </div>
                <button className="btn-primary" onClick={openAdd}>
                    <Plus size={15} strokeWidth={2} /> Add supplier
                </button>
            </div>

            {/* ── Search ── */}
            <div className="sp-toolbar">
                <div className="rc-search">
                    <Search size={15} strokeWidth={1.5} />
                    <input
                        placeholder="Search suppliers…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className="rc-search-clear" onClick={() => setSearch('')}>
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="rc-error">
                    <AlertTriangle size={15} /> {error}
                </div>
            )}

            {/* ── Loading skeletons ── */}
            {loading && (
                <div className="sp-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rc-skeleton" style={{ height: 160 }} />
                    ))}
                </div>
            )}

            {/* ── Empty state ── */}
            {!loading && !error && suppliers.length === 0 && (
                <div className="rc-empty">
                    <div className="rc-empty-icon">🏭</div>
                    <p>{search ? 'No suppliers found' : 'No suppliers yet'}</p>
                    <span>{search ? 'Try a different search term.' : 'Add your first supplier to get started.'}</span>
                    {!search && (
                        <button className="btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>
                            <Plus size={15} /> Add supplier
                        </button>
                    )}
                </div>
            )}

            {/* ── Supplier cards ── */}
            {!loading && suppliers.length > 0 && (
                <div className="sp-grid">
                    {suppliers.map((s, i) => (
                        <div
                            key={s.id}
                            className={`sp-card ${selectedId === s.id ? 'selected' : ''}`}
                            style={{ animationDelay: `${i * 30}ms` }}
                            onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                        >
                            <div className="sp-card-top">
                                <div className="sp-avatar">{s.name.slice(0, 2).toUpperCase()}</div>
                                <div className="sp-card-actions" onClick={e => e.stopPropagation()}>
                                    <button className="rc-btn" onClick={() => openEdit(s)} title="Edit">
                                        <Pencil size={13} strokeWidth={1.5} />
                                    </button>
                                    <button className="rc-btn rc-btn-danger" onClick={() => setDeleteTarget(s)} title="Delete">
                                        <Trash2 size={13} strokeWidth={1.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="sp-name">{s.name}</div>
                            <span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                                {s.status}
                            </span>

                            {s.description && (
                                <p className="sp-desc">{s.description}</p>
                            )}

                            <div className="sp-contacts">
                                {s.contact_email && (
                                    <div className="sp-contact">
                                        <Mail size={12} strokeWidth={1.5} />
                                        <span>{s.contact_email}</span>
                                    </div>
                                )}
                                {s.phone && (
                                    <div className="sp-contact">
                                        <Phone size={12} strokeWidth={1.5} />
                                        <span>{s.phone}</span>
                                    </div>
                                )}
                                {s.address && (
                                    <div className="sp-contact">
                                        <MapPin size={12} strokeWidth={1.5} />
                                        <span>{s.address}</span>
                                    </div>
                                )}
                            </div>

                            <div className="sp-click-hint">
                                <Boxes size={12} strokeWidth={1.5} />
                                <span>Click to view products</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Detail drawer ── */}
            <SupplierDrawer
                supplierId={selectedId}
                onClose={() => setSelectedId(null)}
                onEdit={s => { setSelectedId(null); openEdit(s) }}
            />

            {/* ── Add / Edit modal ── */}
            <SupplierModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                supplier={editing}
            />

            {/* ── Delete confirm ── */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
                    <div className="modal-box" style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3>Delete supplier?</h3>
                            <button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={18} /></button>
                        </div>
                        <p style={{ color: '#6b6864', fontSize: 14, padding: '12px 0 8px', lineHeight: 1.6 }}>
                            <strong style={{ color: '#1a1917' }}>{deleteTarget.name}</strong> will be permanently removed.
                        </p>
                        <p style={{ color: '#b93030', fontSize: 13, paddingBottom: 20 }}>
                            Resources linked to this supplier will lose their supplier reference.
                        </p>
                        <div className="modal-actions">
                            <button className="btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
                            <button className="btn-danger" onClick={handleDelete} disabled={deleteLoading}>
                                {deleteLoading ? 'Deleting…' : 'Delete supplier'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ── */}
            {toast && (
                <div className={`toast ${toast.type === 'danger' ? 'toast-danger' : 'toast-success'}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    )
}