import { useState, useMemo } from 'react'
import { Plus, Search, SlidersHorizontal, LayoutGrid, List, AlertTriangle, Pencil, Trash2, X } from 'lucide-react'
import { useResources, useCategories, useSupplierList } from '../hooks/useResources'
import ResourceCard from '../components/resources/ResourceCard'
import ResourceModal from '../components/resources/ResourceModal'
import '../components/resources/resources.css'

const STATUSES = ['active', 'pending', 'discontinued']

export default function ResourceCatalog() {
    const [search, setSearch] = useState('')
    const [filterCat, setFilterCat] = useState('')
    const [filterSup, setFilterSup] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [view, setView] = useState('grid')
    const [showFilters, setShowFilters] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [toast, setToast] = useState(null)

    const filters = useMemo(() => ({
        search,
        category_id: filterCat,
        supplier_id: filterSup,
        status: filterStatus,
    }), [search, filterCat, filterSup, filterStatus])

    const { resources, loading, error, createResource, updateResource, deleteResource } = useResources(filters)
    const categories = useCategories()
    const suppliers = useSupplierList()

    function showToast(msg, type = 'success') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    function openAdd() { setEditing(null); setModalOpen(true) }
    function openEdit(r) { setEditing(r); setModalOpen(true) }

    async function handleSave(payload) {
        if (editing) {
            await updateResource(editing.id, payload)
            showToast('Resource updated.')
        } else {
            await createResource(payload)
            showToast('Resource added.')
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return
        setDeleteLoading(true)
        try {
            await deleteResource(deleteTarget.id)
            showToast('Resource deleted.', 'danger')
        } catch (e) {
            showToast(e.message, 'danger')
        }
        setDeleteLoading(false)
        setDeleteTarget(null)
    }

    const activeFilters = [filterCat, filterSup, filterStatus].filter(Boolean).length

    return (
        <div className="rc-page">
            {/* ── Header ── */}
            <div className="page-header">
                <div className="page-header-text">
                    <h2>Resource Catalog</h2>
                    <p>{loading ? 'Loading…' : `${resources.length} item${resources.length !== 1 ? 's' : ''} found`}</p>
                </div>
                <button className="btn-primary" onClick={openAdd}>
                    <Plus size={15} strokeWidth={2} /> Add resource
                </button>
            </div>

            {/* ── Toolbar ── */}
            <div className="rc-toolbar">
                <div className="rc-search">
                    <Search size={15} strokeWidth={1.5} />
                    <input
                        placeholder="Search resources…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className="rc-search-clear" onClick={() => setSearch('')}>
                            <X size={12} />
                        </button>
                    )}
                </div>

                <button
                    className={`rc-filter-btn ${showFilters ? 'active' : ''}`}
                    onClick={() => setShowFilters(s => !s)}
                >
                    <SlidersHorizontal size={15} strokeWidth={1.5} />
                    Filters
                    {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
                </button>

                <div className="rc-view-toggle">
                    <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
                        <LayoutGrid size={15} strokeWidth={1.5} />
                    </button>
                    <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
                        <List size={15} strokeWidth={1.5} />
                    </button>
                </div>
            </div>

            {/* ── Filter panel ── */}
            {showFilters && (
                <div className="rc-filter-panel">
                    <div className="mf-group">
                        <label>Category</label>
                        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                            <option value="">All categories</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                            ))}
                        </select>
                    </div>
                    <div className="mf-group">
                        <label>Supplier</label>
                        <select value={filterSup} onChange={e => setFilterSup(e.target.value)}>
                            <option value="">All suppliers</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="mf-group">
                        <label>Status</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="">All statuses</option>
                            {STATUSES.map(s => (
                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                    {activeFilters > 0 && (
                        <button className="btn-ghost" onClick={() => { setFilterCat(''); setFilterSup(''); setFilterStatus('') }}>
                            Clear all
                        </button>
                    )}
                </div>
            )}

            {/* ── Error ── */}
            {error && (
                <div className="rc-error">
                    <AlertTriangle size={15} /> {error}
                </div>
            )}

            {/* ── Loading skeletons ── */}
            {loading && (
                <div className="rc-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rc-skeleton" />
                    ))}
                </div>
            )}

            {/* ── Empty state ── */}
            {!loading && !error && resources.length === 0 && (
                <div className="rc-empty">
                    <div className="rc-empty-icon">📦</div>
                    <p>No resources found</p>
                    <span>
                        {search || activeFilters
                            ? 'Try adjusting your search or filters.'
                            : 'Add your first resource to get started.'}
                    </span>
                    {!search && !activeFilters && (
                        <button className="btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>
                            <Plus size={15} /> Add resource
                        </button>
                    )}
                </div>
            )}

            {/* ── Grid view ── */}
            {!loading && resources.length > 0 && view === 'grid' && (
                <div className="rc-grid">
                    {resources.map((r, i) => (
                        <ResourceCard
                            key={r.id}
                            resource={r}
                            onEdit={openEdit}
                            onDelete={setDeleteTarget}
                            style={{ animationDelay: `${i * 40}ms` }}
                        />
                    ))}
                </div>
            )}

            {/* ── List view ── */}
            {!loading && resources.length > 0 && view === 'list' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="rc-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Supplier</th>
                                <th>Unit cost</th>
                                <th>Qty</th>
                                <th>Status</th>
                                <th>Procured</th>
                                <th>Added</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {resources.map(r => (
                                <tr key={r.id}>
                                    <td>
                                        <div className="rt-name-cell">
                                            {r.image_url
                                                ? <img src={r.image_url} alt={r.name} className="rt-thumb" />
                                                : <div className="rt-thumb-empty" />
                                            }
                                            <span>{r.name}</span>
                                        </div>
                                    </td>
                                    <td>
                                        {r.categories
                                            ? <span className={`badge ${r.categories.type === 'CAPEX' ? 'badge-blue' : 'badge-purple'}`}>{r.categories.name}</span>
                                            : <span className="badge badge-gray">—</span>
                                        }
                                    </td>
                                    <td className="rc-muted">{r.suppliers?.name ?? '—'}</td>
                                    <td className="rc-cost-cell">
                                        {new Intl.NumberFormat('en-PH', { style: 'currency', currency: r.currency || 'PHP' }).format(r.unit_cost)}
                                        {r.unit && <span className="rc-unit"> {r.unit}</span>}
                                    </td>
                                    <td className="rc-muted">{r.quantity ?? 0}</td>
                                    <td>
                                        <span className={`badge ${r.status === 'active' ? 'badge-green' : r.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="rc-muted" style={{ fontSize: 12 }}>
                                        {r.procured_at
                                            ? new Date(r.procured_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                                            : '—'}
                                    </td>
                                    <td className="rc-muted" style={{ fontSize: 12 }}>
                                        {new Date(r.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="rc-btn" onClick={() => openEdit(r)}><Pencil size={13} /></button>
                                            <button className="rc-btn rc-btn-danger" onClick={() => setDeleteTarget(r)}><Trash2 size={13} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Add / Edit Modal ── */}
            <ResourceModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                resource={editing}
                categories={categories}
                suppliers={suppliers}
            />

            {/* ── Delete confirm ── */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
                    <div className="modal-box" style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3>Delete resource?</h3>
                            <button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={18} /></button>
                        </div>
                        <p style={{ color: '#6b6864', fontSize: 14, padding: '12px 0 24px', lineHeight: 1.6 }}>
                            <strong style={{ color: '#1a1917' }}>{deleteTarget.name}</strong> will be permanently removed.
                            This cannot be undone.
                        </p>
                        <div className="modal-actions">
                            <button className="btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
                            <button className="btn-danger" onClick={handleDelete} disabled={deleteLoading}>
                                {deleteLoading ? 'Deleting…' : 'Delete resource'}
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