import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Plus, Search, X, SlidersHorizontal, Pencil, Trash2,
    AlertTriangle, TrendingUp, Calculator, MapPin
} from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import { useInflationRatesReadonly } from '../hooks/useResources'
import { useSitesReadonly } from '../hooks/useSites'
import { adjustedProjectCost } from '../services/inflationEngine'
import ProjectModal from '../components/projects/ProjectModal'
import EstimatorModal from '../components/projects/EstimatorModal'
import '../components/projects/projects.css'

const STATUSES = ['planned', 'ongoing', 'completed', 'cancelled']

const STATUS_BADGE = {
    planned: 'badge-gray',
    ongoing: 'badge-purple',
    completed: 'badge-blue',
    cancelled: 'badge-red',
}

const STATUS_DOT = {
    planned: '#aaa89f',
    ongoing: '#8b5cf6',
    completed: '#2563eb',
    cancelled: '#dc2626',
}

function formatCost(amount, currency = 'PHP') {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency', currency,
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount || 0)
}

function formatDate(d) {
    if (!d) return null
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ProjectCatalog() {
    const navigate = useNavigate()

    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterSite, setFilterSite] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [inflationOn, setInflationOn] = useState(false)
    const [inflationYear, setInflationYear] = useState(new Date().getFullYear())
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [editLineItems, setEditLineItems] = useState([])
    const [estimatorOpen, setEstimatorOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [toast, setToast] = useState(null)

    // line items keyed by project_id — loaded once when inflation is first toggled on
    const [lineItemsMap, setLineItemsMap] = useState({})
    const [lineItemsLoading, setLineItemsLoading] = useState(false)

    const filters = useMemo(() => ({ search, status: filterStatus, site_id: filterSite }), [search, filterStatus, filterSite])
    const { projects, loading, error, createProject, updateProject, deleteProject } = useProjects(filters)
    const inflationRates = useInflationRatesReadonly()
    const { sites } = useSitesReadonly()

    // Fetch ALL project line items (with categories) when inflation is toggled on.
    // We do this in one query rather than N queries to avoid waterfalls.
    useEffect(() => {
        if (!inflationOn) return
        if (Object.keys(lineItemsMap).length > 0) return // already loaded

        async function fetchAllLineItems() {
            setLineItemsLoading(true)
            const { supabase } = await import('../lib/supabaseClient')
            const { data, error } = await supabase
                .from('project_resources')
                .select(`
                    id,
                    project_id,
                    quantity,
                    unit_cost_snapshot,
                    capex_opex,
                    working_days,
                    resources (
                        id, name, unit, resource_type,
                        categories ( id, name, type )
                    )
                `)

            if (!error && data) {
                // Group by project_id
                const map = {}
                for (const item of data) {
                    if (!map[item.project_id]) map[item.project_id] = []
                    map[item.project_id].push(item)
                }
                setLineItemsMap(map)
            }
            setLineItemsLoading(false)
        }

        fetchAllLineItems()
    }, [inflationOn])

    function showToast(msg, type = 'success') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3200)
    }

    function openAdd() { setEditing(null); setEditLineItems([]); setModalOpen(true) }

    async function openEdit(e, project) {
        e.stopPropagation()
        const { supabase } = await import('../lib/supabaseClient')
        const { data } = await supabase
            .from('project_resources')
            .select(`
                *,
                resources(
                    id, name, unit, currency,
                    resource_type, trade, image_url,
                    categories(id, name, type)
                )
            `)
            .eq('project_id', project.id)
        setEditing(project)
        setEditLineItems(data || [])
        setModalOpen(true)
    }

    async function handleSave(payload, lineItems) {
        if (editing) {
            await updateProject(editing.id, payload, lineItems)
            showToast('Project updated.')
        } else {
            await createProject(payload, lineItems)
            showToast('Project created.')
        }
        // Invalidate the line items cache so next inflation toggle re-fetches
        setLineItemsMap({})
    }

    async function handleDelete() {
        if (!deleteTarget) return
        setDeleteLoading(true)
        try {
            await deleteProject(deleteTarget.id)
            showToast('Project deleted.', 'danger')
            setLineItemsMap({})
        } catch (e) { showToast(e.message, 'danger') }
        setDeleteLoading(false)
        setDeleteTarget(null)
    }

    /**
     * Get the display cost for a project card.
     *
     * When inflation is OFF  → raw total_cost from DB.
     * When inflation is ON   → adjustedProjectCost WITH line items, so the
     *                          math is identical to ProjectDetail's per-line,
     *                          per-category compounding.
     */
    function getDisplayCost(project) {
        const total = project.total_cost ?? 0

        if (!inflationOn) return formatCost(total, project.currency)

        const fromYear = project.start_date
            ? new Date(project.start_date).getFullYear()
            : new Date(project.created_at).getFullYear()

        if (inflationYear <= fromYear) return formatCost(total, project.currency)

        // Pass the per-project line items so adjustedProjectCost uses the same
        // per-category compounding as ProjectDetail.
        const items = lineItemsMap[project.id] ?? null
        const adjusted = adjustedProjectCost(project, inflationRates, inflationYear, items)
        return formatCost(adjusted, project.currency)
    }

    const activeFilters = [filterStatus, filterSite].filter(Boolean).length
    const currentYear = new Date().getFullYear()

    return (
        <div className="pj-page">
            <div className="page-header">
                <div className="page-header-text">
                    <h2>Project Catalog</h2>
                    <p>{loading ? 'Loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-ghost" onClick={() => setEstimatorOpen(true)}>
                        <Calculator size={15} strokeWidth={1.5} /> Cost estimator
                    </button>
                    <button className="btn-primary" onClick={openAdd}>
                        <Plus size={15} strokeWidth={2} /> New project
                    </button>
                </div>
            </div>

            <div className="rc-toolbar">
                <div className="rc-search" style={{ maxWidth: 360 }}>
                    <Search size={15} strokeWidth={1.5} />
                    <input
                        placeholder="Search projects…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className="rc-search-clear" onClick={() => setSearch('')}><X size={12} /></button>
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

                <div className={`pj-inflation-toggle ${inflationOn ? 'active' : ''}`}>
                    <button
                        className="pj-inflation-btn"
                        onClick={() => setInflationOn(s => !s)}
                        title="Toggle inflation-adjusted costs"
                    >
                        <TrendingUp size={14} strokeWidth={1.5} />
                        {inflationOn ? 'Inflation on' : 'Inflation off'}
                    </button>
                    {inflationOn && (
                        <div className="pj-inflation-year">
                            <span>to</span>
                            <input
                                type="number"
                                min={currentYear}
                                max={currentYear + 30}
                                value={inflationYear}
                                onChange={e => setInflationYear(parseInt(e.target.value))}
                            />
                        </div>
                    )}
                </div>
            </div>

            {showFilters && (
                <div className="rc-filter-panel">
                    <div className="mf-group">
                        <label>Status</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="">All statuses</option>
                            {STATUSES.map(s => (
                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="mf-group">
                        <label>Site</label>
                        <select value={filterSite} onChange={e => setFilterSite(e.target.value)}>
                            <option value="">All sites</option>
                            {sites.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name}{s.code ? ` (${s.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    {activeFilters > 0 && (
                        <button className="btn-ghost" onClick={() => { setFilterStatus(''); setFilterSite('') }}>Clear all</button>
                    )}
                </div>
            )}

            {error && <div className="rc-error"><AlertTriangle size={15} /> {error}</div>}

            {(loading || (inflationOn && lineItemsLoading)) && (
                <div className="pj-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rc-skeleton" style={{ height: 180 }} />
                    ))}
                </div>
            )}

            {!loading && !lineItemsLoading && !error && projects.length === 0 && (
                <div className="rc-empty">
                    <div className="rc-empty-icon">🏗️</div>
                    <p>{search || activeFilters ? 'No projects found' : 'No projects yet'}</p>
                    <span>{search || activeFilters ? 'Try adjusting your search or filters.' : 'Create your first project to get started.'}</span>
                    {!search && !activeFilters && (
                        <button className="btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>
                            <Plus size={15} /> New project
                        </button>
                    )}
                </div>
            )}

            {!loading && !lineItemsLoading && projects.length > 0 && (
                <div className="pj-grid">
                    {projects.map((p, i) => (
                        <div
                            key={p.id}
                            className="pj-card"
                            style={{ animationDelay: `${i * 35}ms` }}
                            onClick={() => navigate(`/projects/${p.id}`)}
                        >
                            <div className="pj-card-top">
                                <span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>
                                    <span className="pj-status-dot" style={{ background: STATUS_DOT[p.status] }} />
                                    {p.status}
                                </span>
                                <div className="rc-actions" onClick={e => e.stopPropagation()}>
                                    <button className="rc-btn" onClick={e => openEdit(e, p)} title="Edit">
                                        <Pencil size={13} strokeWidth={1.5} />
                                    </button>
                                    <button className="rc-btn rc-btn-danger"
                                        onClick={e => { e.stopPropagation(); setDeleteTarget(p) }} title="Delete">
                                        <Trash2 size={13} strokeWidth={1.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="pj-card-name">{p.name}</div>

                            {p.description && (
                                <p className="pj-card-desc">{p.description}</p>
                            )}

                            {/* Site / Location — show whichever is set */}
                            {(p.sites || p.location) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#7a7872', margin: '2px 0 4px' }}>
                                    <MapPin size={11} strokeWidth={1.5} style={{ color: '#c9a84c', flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {p.sites
                                            ? `${p.sites.name}${p.sites.code ? ` (${p.sites.code})` : ''}${p.location ? `  ·  ${p.location}` : ''}`
                                            : p.location
                                        }
                                    </span>
                                </div>
                            )}

                            <div className="pj-card-cost">
                                {getDisplayCost(p)}
                                {inflationOn && (
                                    <span className="pj-inflation-label">est. {inflationYear}</span>
                                )}
                            </div>

                            {(p.start_date || p.end_date) && (
                                <div className="pj-card-dates">
                                    <span>{formatDate(p.start_date) ?? '—'}</span>
                                    <span className="pj-date-arrow">→</span>
                                    <span>{formatDate(p.end_date) ?? 'Ongoing'}</span>
                                </div>
                            )}

                            <div className="pj-card-footer">
                                <span className="pj-click-hint">View details →</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ProjectModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                project={editing}
                initialLineItems={editLineItems}
            />

            <EstimatorModal
                open={estimatorOpen}
                onClose={() => setEstimatorOpen(false)}
            />

            {deleteTarget && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
                    <div className="modal-box" style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3>Delete project?</h3>
                            <button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={18} /></button>
                        </div>
                        <p style={{ color: '#6b6864', fontSize: 14, padding: '12px 0 8px', lineHeight: 1.6 }}>
                            <strong style={{ color: '#1a1917' }}>{deleteTarget.name}</strong> and all its resources will be permanently deleted.
                        </p>
                        <div className="modal-actions">
                            <button className="btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
                            <button className="btn-danger" onClick={handleDelete} disabled={deleteLoading}>
                                {deleteLoading ? 'Deleting…' : 'Delete project'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`toast ${toast.type === 'danger' ? 'toast-danger' : 'toast-success'}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    )
}