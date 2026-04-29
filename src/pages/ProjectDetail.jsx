import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, Pencil, Trash2, Calendar, DollarSign,
    Package, TrendingUp, AlertTriangle, Clock, CheckCircle2,
    XCircle, CircleDot, X, HardHat
} from 'lucide-react'
import { useProjectDetail } from '../hooks/useProjects'
import { useProjects } from '../hooks/useProjects'
import { useInflationRatesReadonly } from '../hooks/useResources'
import { adjustedLineItemCost } from '../services/inflationEngine'
import ProjectModal from '../components/projects/ProjectModal'
import ProjectLaborTab from '../components/projects/ProjectLaborTab'
import '../components/projects/projects.css'

const STATUS_CONFIG = {
    planned: { badge: 'badge-gray', icon: CircleDot, color: '#aaa89f' },
    ongoing: { badge: 'badge-purple', icon: Clock, color: '#8b5cf6' },
    completed: { badge: 'badge-blue', icon: CheckCircle2, color: '#2563eb' },
    cancelled: { badge: 'badge-red', icon: XCircle, color: '#dc2626' },
}

function formatCost(amount, currency = 'PHP') {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency', currency,
        minimumFractionDigits: 2,
    }).format(amount || 0)
}

function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
}

function getDuration(start, end) {
    if (!start || !end) return null
    const days = Math.round((new Date(end) - new Date(start)) / 86400000)
    if (days < 30) return `${days} days`
    if (days < 365) return `${Math.floor(days / 30)} months`
    return `${(days / 365).toFixed(1)} years`
}

// ── Unified duration resolver — works for ALL resource types ──
// Returns the duration multiplier based on unit + working days.
// Per day → raw days, per week → ceil(days/5), per month → ceil(days/22)
// Returns null for flat/lump-sum items (no time multiplier needed).
function resolveDurationFromUnit(unit, workingDays) {
    const u = (unit || '').toLowerCase().trim()
    if (u === 'per day' || u === 'day') return workingDays
    if (u === 'per week' || u === 'week') return Math.ceil(workingDays / 5)
    if (u === 'per month' || u === 'month') return Math.ceil(workingDays / 22)
    return null
}

function TimelineBar({ start, end, status }) {
    if (!start) return null

    const startDate = new Date(start)
    const endDate = end ? new Date(end) : null
    const now = new Date()
    const color = STATUS_CONFIG[status]?.color || '#aaa89f'

    if (!endDate) {
        const daysElapsed = Math.floor((now - startDate) / 86400000)
        return (
            <div className="pj-timeline-bar-wrap">
                <div className="pj-timeline-bar-track">
                    <div className="pj-timeline-bar-fill" style={{ width: '40%', background: color, opacity: 0.5 }} />
                </div>
                <div className="pj-timeline-bar-labels">
                    <span>{startDate.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}</span>
                    <span style={{ color: '#aaa89f' }}>{daysElapsed} days in · no end date set</span>
                    <span style={{ color: '#aaa89f' }}>ongoing</span>
                </div>
            </div>
        )
    }

    const total = endDate - startDate
    const elapsed = Math.min(Math.max(now - startDate, 0), total)
    const pct = total > 0 ? Math.round((elapsed / total) * 100) : 100

    if (total <= 0) {
        return (
            <div className="pj-timeline-bar-wrap">
                <div className="pj-timeline-bar-track">
                    <div className="pj-timeline-bar-fill" style={{ width: '100%', background: color }} />
                </div>
                <div className="pj-timeline-bar-labels">
                    <span>{startDate.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}</span>
                    <span style={{ color: '#aaa89f' }}>Start and end date are the same</span>
                </div>
            </div>
        )
    }

    const totalDays = Math.round(total / 86400000)
    const daysLeft = Math.max(0, Math.round((endDate - now) / 86400000))
    const isOver = now > endDate
    const midLabel = isOver
        ? `Completed · ${totalDays}d total`
        : `${pct}% elapsed · ${daysLeft}d remaining`

    return (
        <div className="pj-timeline-bar-wrap">
            <div className="pj-timeline-bar-track">
                <div className="pj-timeline-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className="pj-timeline-bar-labels">
                <span>{startDate.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}</span>
                <span style={{ color: isOver ? color : undefined }}>{midLabel}</span>
                <span>{endDate.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}</span>
            </div>
        </div>
    )
}

export default function ProjectDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { project, lineItems, loading, error } = useProjectDetail(id)
    const { updateProject, deleteProject } = useProjects({})

    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [toast, setToast] = useState(null)
    const [inflationOn, setInflationOn] = useState(false)
    const [activeTab, setActiveTab] = useState('costs')

    const inflationRates = useInflationRatesReadonly()

    function showToast(msg, type = 'success') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    async function handleSave(payload, items) {
        await updateProject(id, payload, items)
        showToast('Project updated.')
        setEditOpen(false)
        window.location.reload()
    }

    async function handleDelete() {
        setDeleteLoading(true)
        try {
            await deleteProject(id)
            navigate('/projects', { replace: true })
        } catch (e) {
            showToast(e.message, 'danger')
        }
        setDeleteLoading(false)
    }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
            <div className="loading-spinner" />
        </div>
    )

    if (error || !project) return (
        <div className="rc-error" style={{ marginTop: 40 }}>
            <AlertTriangle size={15} /> {error || 'Project not found.'}
        </div>
    )

    const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.planned
    const StatusIcon = statusCfg.icon
    const currentYear = new Date().getFullYear()
    const projectBaseYear = project.start_date
        ? new Date(project.start_date).getFullYear()
        : new Date(project.created_at).getFullYear()

    function getAdjustedLineCost(item) {
        if (!inflationOn) return item.unit_cost_snapshot
        return adjustedLineItemCost(item, inflationRates, currentYear, projectBaseYear)
    }

    // ── Resolve working days for any item ────────────────
    // Uses stored working_days first, then falls back to counting from dates.
    function resolveWorkingDays(item) {
        if (item.working_days) return item.working_days

        // Only count days if the item is time-based
        const unit = (item.resources?.unit || item.unit || '').toLowerCase().trim()
        const isLabor = item.resources?.resource_type === 'Labor' || item.resource_type === 'Labor'
        const isTimeBased = resolveDurationFromUnit(unit, 1) !== null

        if (!isTimeBased && !isLabor) return 0

        const start = item.labor_start_date || project.start_date
        const end = item.labor_end_date || project.end_date
        if (!start || !end) return 0

        const mode = project.working_days_mode || 'working_days'
        if (mode === 'calendar_days') {
            return Math.max(0, Math.round((new Date(end) - new Date(start)) / 86400000) + 1)
        }

        // Working days — count weekdays only
        const s = new Date(start); s.setHours(0, 0, 0, 0)
        const e = new Date(end); e.setHours(0, 0, 0, 0)
        let count = 0
        const cur = new Date(s)
        while (cur <= e) {
            const d = cur.getDay()
            if (d !== 0 && d !== 6) count++
            cur.setDate(cur.getDate() + 1)
        }
        return count
    }

    // ── Build display items — unified unit-based calculation ──
    const displayItems = lineItems.map(item => {
        const adjUnitCost = getAdjustedLineCost(item)

        // Always read the unit from the resource record first, then fall back to item-level
        const unit = (item.resources?.unit || item.unit || '').toLowerCase().trim()
        const workingDays = resolveWorkingDays(item)

        // ✅ Same logic for BOTH labor and non-labor — unit drives the multiplier
        const duration = resolveDurationFromUnit(unit, workingDays)

        const displayTotal = duration !== null
            ? adjUnitCost * item.quantity * duration
            : adjUnitCost * item.quantity

        return {
            ...item,
            _resolvedUnit: unit,
            display_unit_cost: adjUnitCost,
            display_total: displayTotal,
            working_days: workingDays,
            _duration: duration,
        }
    })

    const capexTotal = displayItems.filter(i => i.capex_opex === 'CAPEX').reduce((s, i) => s + i.display_total, 0)
    const opexTotal = displayItems.filter(i => i.capex_opex === 'OPEX').reduce((s, i) => s + i.display_total, 0)
    const otherTotal = displayItems.filter(i => !i.capex_opex).reduce((s, i) => s + i.display_total, 0)
    const laborTotal = displayItems
        .filter(i => i.resources?.resource_type === 'Labor' || i.resource_type === 'Labor')
        .reduce((s, i) => s + i.display_total, 0)
    const grandTotal = displayItems.reduce((s, i) => s + i.display_total, 0)

    // Human-readable label for the qty cell in the table
    function qtyLabel(item) {
        const isLabor = item.resources?.resource_type === 'Labor' || item.resource_type === 'Labor'
        const u = item._resolvedUnit
        const duration = item._duration

        if (duration === null) return item.quantity  // flat item

        const unitWord = u === 'per week' || u === 'week' ? 'week'
            : u === 'per month' || u === 'month' ? 'month'
                : 'day'

        return (
            <div>
                <div style={{ fontWeight: 500, color: '#1a1917' }}>
                    {item.quantity} {isLabor ? `worker${item.quantity !== 1 ? 's' : ''}` : `unit${item.quantity !== 1 ? 's' : ''}`}
                </div>
                <div style={{ fontSize: 11, color: '#c9a84c' }}>
                    × {duration} {unitWord}{duration !== 1 ? 's' : ''}
                </div>
            </div>
        )
    }

    return (
        <div className="pjd-page">
            <button className="pjd-back" onClick={() => navigate('/projects')}>
                <ArrowLeft size={16} strokeWidth={1.5} /> Back to projects
            </button>

            {/* ── Hero header ── */}
            <div className="pjd-hero">
                <div className="pjd-hero-left">
                    <div className="pjd-hero-status">
                        <StatusIcon size={16} strokeWidth={1.5} style={{ color: statusCfg.color }} />
                        <span className={`badge ${statusCfg.badge}`}>{project.status}</span>
                    </div>
                    <h1 className="pjd-hero-title">{project.name}</h1>
                    {project.description && (
                        <p className="pjd-hero-desc">{project.description}</p>
                    )}
                </div>
                <div className="pjd-hero-actions">
                    <div className={`pj-inflation-toggle ${inflationOn ? 'active' : ''}`}>
                        <button
                            className="pj-inflation-btn"
                            onClick={() => setInflationOn(s => !s)}
                            title="Toggle inflation-adjusted costs to today's value"
                        >
                            <TrendingUp size={14} strokeWidth={1.5} />
                            {inflationOn ? 'Inflation on' : 'Inflation off'}
                        </button>
                    </div>
                    <button className="btn-ghost" onClick={() => setEditOpen(true)}>
                        <Pencil size={14} strokeWidth={1.5} /> Edit
                    </button>
                    <button className="btn-danger" onClick={() => setDeleteOpen(true)}>
                        <Trash2 size={14} strokeWidth={1.5} /> Delete
                    </button>
                </div>
            </div>

            {/* ── Stat strip ── */}
            <div className="pjd-stat-strip">
                <div className="pjd-stat">
                    <DollarSign size={16} strokeWidth={1.5} />
                    <div>
                        <div className="pjd-stat-value">{formatCost(grandTotal, project.currency)}</div>
                        <div className="pjd-stat-label">
                            {inflationOn ? `Adjusted (${projectBaseYear} → ${currentYear})` : 'Total cost'}
                        </div>
                    </div>
                </div>
                <div className="pjd-stat-divider" />
                <div className="pjd-stat">
                    <Package size={16} strokeWidth={1.5} />
                    <div>
                        <div className="pjd-stat-value">{lineItems.length}</div>
                        <div className="pjd-stat-label">Resources</div>
                    </div>
                </div>
                <div className="pjd-stat-divider" />
                <div className="pjd-stat">
                    <Calendar size={16} strokeWidth={1.5} />
                    <div>
                        <div className="pjd-stat-value">{getDuration(project.start_date, project.end_date) || '—'}</div>
                        <div className="pjd-stat-label">Duration</div>
                    </div>
                </div>
                {laborTotal > 0 && <>
                    <div className="pjd-stat-divider" />
                    <div className="pjd-stat">
                        <HardHat size={16} strokeWidth={1.5} />
                        <div>
                            <div className="pjd-stat-value">{formatCost(laborTotal, project.currency)}</div>
                            <div className="pjd-stat-label">Labor</div>
                        </div>
                    </div>
                </>}
                {(capexTotal > 0 || opexTotal > 0) && <>
                    <div className="pjd-stat-divider" />
                    <div className="pjd-stat">
                        <TrendingUp size={16} strokeWidth={1.5} />
                        <div>
                            <div className="pjd-stat-value">{formatCost(capexTotal, project.currency)}</div>
                            <div className="pjd-stat-label">CAPEX</div>
                        </div>
                    </div>
                    <div className="pjd-stat-divider" />
                    <div className="pjd-stat">
                        <TrendingUp size={16} strokeWidth={1.5} style={{ transform: 'scaleX(-1)' }} />
                        <div>
                            <div className="pjd-stat-value">{formatCost(opexTotal, project.currency)}</div>
                            <div className="pjd-stat-label">OPEX</div>
                        </div>
                    </div>
                </>}
            </div>

            {/* ── Tab strip ── */}
            <div className="pjd-tabs">
                <button
                    className={`pjd-tab ${activeTab === 'costs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('costs')}
                >
                    <DollarSign size={14} strokeWidth={1.5} /> Cost breakdown
                </button>
                <button
                    className={`pjd-tab ${activeTab === 'labor' ? 'active' : ''}`}
                    onClick={() => setActiveTab('labor')}
                >
                    <HardHat size={14} strokeWidth={1.5} /> Labor
                </button>
            </div>

            {/* ── Labor tab ── */}
            {activeTab === 'labor' && (
                <ProjectLaborTab project={project} />
            )}

            {/* ── Costs tab ── */}
            {activeTab === 'costs' && (
                <div className="pjd-body">
                    <div className="pjd-left">

                        {/* Timeline card */}
                        <div className="card pjd-section">
                            <div className="pjd-section-title">
                                <Calendar size={15} strokeWidth={1.5} /> Timeline
                            </div>
                            <div className="pjd-timeline-dates">
                                <div className="pjd-timeline-date">
                                    <span className="pjd-date-label">Start date</span>
                                    <span className="pjd-date-value">{formatDate(project.start_date)}</span>
                                </div>
                                <div className="pjd-timeline-arrow">→</div>
                                <div className="pjd-timeline-date">
                                    <span className="pjd-date-label">End date</span>
                                    <span className="pjd-date-value">{formatDate(project.end_date)}</span>
                                </div>
                                {getDuration(project.start_date, project.end_date) && (
                                    <div className="pjd-timeline-date" style={{ marginLeft: 'auto' }}>
                                        <span className="pjd-date-label">Duration</span>
                                        <span className="pjd-date-value" style={{ color: statusCfg.color }}>
                                            {getDuration(project.start_date, project.end_date)}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <TimelineBar start={project.start_date} end={project.end_date} status={project.status} />
                        </div>

                        {/* Cost breakdown card */}
                        <div className="card pjd-section">
                            <div className="pjd-section-title" style={{ justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    <DollarSign size={15} strokeWidth={1.5} /> Cost breakdown
                                </div>
                                {inflationOn && (
                                    <span className="badge rc-inflation-badge" style={{ fontSize: 11 }}>
                                        inflation-adjusted · {projectBaseYear} → {currentYear}
                                    </span>
                                )}
                            </div>
                            {lineItems.length === 0 ? (
                                <p style={{ color: '#aaa89f', fontSize: 13.5 }}>No resources added to this project.</p>
                            ) : (
                                <>
                                    <table className="rc-table pjd-resource-table">
                                        <thead>
                                            <tr>
                                                <th>Resource</th>
                                                <th>Type</th>
                                                <th style={{ textAlign: 'right' }}>Unit cost</th>
                                                <th style={{ textAlign: 'center' }}>Qty / Duration</th>
                                                <th style={{ textAlign: 'right' }}>Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayItems.map(item => {
                                                const isAdjusted = inflationOn && item.display_unit_cost !== item.unit_cost_snapshot
                                                return (
                                                    <tr key={item.id}>
                                                        <td>
                                                            <div className="rt-name-cell">
                                                                {item.resources?.image_url
                                                                    ? <img src={item.resources.image_url} alt="" className="rt-thumb" />
                                                                    : <div className="rt-thumb-empty" />
                                                                }
                                                                <div>
                                                                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>
                                                                        {item.resources?.name || <span style={{ color: '#aaa89f' }}>Custom resource</span>}
                                                                    </div>
                                                                    {item.resources?.categories && (
                                                                        <span
                                                                            className={`badge ${item.resources.categories.type === 'CAPEX' ? 'badge-blue' : 'badge-purple'}`}
                                                                            style={{ fontSize: 10, marginTop: 3 }}
                                                                        >
                                                                            {item.resources.categories.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {item.capex_opex
                                                                ? <span className={`badge ${item.capex_opex === 'CAPEX' ? 'badge-blue' : 'badge-purple'}`}>{item.capex_opex}</span>
                                                                : <span className="badge badge-gray">—</span>
                                                            }
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <div style={{ fontWeight: 500 }}>
                                                                {formatCost(item.display_unit_cost, project.currency)}
                                                                {item._resolvedUnit && (
                                                                    <span style={{ color: '#aaa89f', fontWeight: 400, fontSize: 11 }}> /{item._resolvedUnit.replace('per ', '')}</span>
                                                                )}
                                                            </div>
                                                            {isAdjusted && (
                                                                <div style={{ fontSize: 11, color: '#aaa89f', textDecoration: 'line-through', textDecorationColor: '#c9a84c' }}>
                                                                    {formatCost(item.unit_cost_snapshot, project.currency)}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ textAlign: 'center', color: '#7a7872' }}>
                                                            {qtyLabel(item)}
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 650, color: '#1a1917' }}>
                                                            {formatCost(item.display_total, project.currency)}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>

                                    {/* Totals summary */}
                                    <div className="pjd-cost-summary">
                                        {laborTotal > 0 && (
                                            <div className="pjd-cost-row">
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <HardHat size={13} strokeWidth={1.5} style={{ color: '#c9a84c' }} />
                                                    Labor subtotal
                                                </span>
                                                <span>{formatCost(laborTotal, project.currency)}</span>
                                            </div>
                                        )}
                                        {capexTotal > 0 && (
                                            <div className="pjd-cost-row">
                                                <span><span className="badge badge-blue" style={{ marginRight: 8 }}>CAPEX</span> subtotal</span>
                                                <span>{formatCost(capexTotal, project.currency)}</span>
                                            </div>
                                        )}
                                        {opexTotal > 0 && (
                                            <div className="pjd-cost-row">
                                                <span><span className="badge badge-purple" style={{ marginRight: 8 }}>OPEX</span> subtotal</span>
                                                <span>{formatCost(opexTotal, project.currency)}</span>
                                            </div>
                                        )}
                                        {otherTotal > 0 && (
                                            <div className="pjd-cost-row">
                                                <span><span className="badge badge-gray" style={{ marginRight: 8 }}>Untagged</span> subtotal</span>
                                                <span>{formatCost(otherTotal, project.currency)}</span>
                                            </div>
                                        )}
                                        <div className="pjd-cost-row pjd-cost-total">
                                            <span>
                                                {inflationOn
                                                    ? `Adjusted total (${projectBaseYear} → ${currentYear})`
                                                    : 'Grand total'}
                                            </span>
                                            <span>{formatCost(grandTotal, project.currency)}</span>
                                        </div>
                                        {inflationOn && project.total_cost !== grandTotal && (
                                            <div className="pjd-cost-row" style={{ fontSize: 12, color: '#aaa89f' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                    <TrendingUp size={11} style={{ color: '#c9a84c' }} />
                                                    Original total ({projectBaseYear})
                                                </span>
                                                <span style={{ textDecoration: 'line-through', textDecorationColor: '#c9a84c' }}>
                                                    {formatCost(project.total_cost, project.currency)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Right column ── */}
                    <div className="pjd-right">
                        <div className="card pjd-section">
                            <div className="pjd-section-title">
                                <Package size={15} strokeWidth={1.5} /> Project info
                            </div>
                            <div className="pjd-info-rows">
                                <div className="pjd-info-row">
                                    <span className="pjd-info-label">Status</span>
                                    <span className={`badge ${statusCfg.badge}`}>{project.status}</span>
                                </div>
                                <div className="pjd-info-row">
                                    <span className="pjd-info-label">Currency</span>
                                    <span className="pjd-info-value">{project.currency}</span>
                                </div>
                                <div className="pjd-info-row">
                                    <span className="pjd-info-label">Resources</span>
                                    <span className="pjd-info-value">{lineItems.length} items</span>
                                </div>
                                <div className="pjd-info-row">
                                    <span className="pjd-info-label">Created</span>
                                    <span className="pjd-info-value">{formatDate(project.created_at)}</span>
                                </div>
                                {project.updated_at && (
                                    <div className="pjd-info-row">
                                        <span className="pjd-info-label">Last updated</span>
                                        <span className="pjd-info-value">{formatDate(project.updated_at)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {grandTotal > 0 && (capexTotal > 0 || opexTotal > 0) && (
                            <div className="card pjd-section">
                                <div className="pjd-section-title">
                                    <TrendingUp size={15} strokeWidth={1.5} /> CAPEX vs OPEX
                                </div>
                                <div className="pjd-split-bar">
                                    {capexTotal > 0 && (
                                        <div
                                            className="pjd-split-capex"
                                            style={{ width: `${(capexTotal / grandTotal) * 100}%` }}
                                            title={`CAPEX: ${formatCost(capexTotal, project.currency)}`}
                                        />
                                    )}
                                    {opexTotal > 0 && (
                                        <div
                                            className="pjd-split-opex"
                                            style={{ width: `${(opexTotal / grandTotal) * 100}%` }}
                                            title={`OPEX: ${formatCost(opexTotal, project.currency)}`}
                                        />
                                    )}
                                </div>
                                <div className="pjd-split-legend">
                                    {capexTotal > 0 && (
                                        <div className="pjd-split-legend-item">
                                            <span className="pjd-split-dot" style={{ background: '#2563eb' }} />
                                            <span>CAPEX {((capexTotal / grandTotal) * 100).toFixed(1)}%</span>
                                        </div>
                                    )}
                                    {opexTotal > 0 && (
                                        <div className="pjd-split-legend-item">
                                            <span className="pjd-split-dot" style={{ background: '#8b5cf6' }} />
                                            <span>OPEX {((opexTotal / grandTotal) * 100).toFixed(1)}%</span>
                                        </div>
                                    )}
                                    {otherTotal > 0 && (
                                        <div className="pjd-split-legend-item">
                                            <span className="pjd-split-dot" style={{ background: '#e5e2d9' }} />
                                            <span>Untagged {((otherTotal / grandTotal) * 100).toFixed(1)}%</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Edit modal ── */}
            <ProjectModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                onSave={handleSave}
                project={project}
                initialLineItems={lineItems}
            />

            {/* ── Delete confirm ── */}
            {deleteOpen && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteOpen(false)}>
                    <div className="modal-box" style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3>Delete project?</h3>
                            <button className="modal-close" onClick={() => setDeleteOpen(false)}><X size={18} /></button>
                        </div>
                        <p style={{ color: '#6b6864', fontSize: 14, padding: '12px 0 20px', lineHeight: 1.6 }}>
                            <strong style={{ color: '#1a1917' }}>{project.name}</strong> and all its resource line items will be permanently deleted.
                        </p>
                        <div className="modal-actions">
                            <button className="btn-ghost" onClick={() => setDeleteOpen(false)}>Cancel</button>
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