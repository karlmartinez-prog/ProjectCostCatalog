import { useState, useRef, useMemo } from 'react'
import {
    Plus, Pencil, Trash2, Check, X, GripVertical,
    ChevronLeft, ChevronRight, CalendarDays, AlertTriangle,
    Loader, ToggleLeft, ToggleRight, User, StickyNote
} from 'lucide-react'
import { useProjectPhases, getStatusConfig, PHASE_STATUSES } from '../../hooks/useProjectPhases'

// ── Constants ─────────────────────────────────────────
const LABEL_COL_W = 220   // px — left label column
const ROW_H = 44    // px — height of each phase row
const HEADER_H = 52    // px — time header height
const TODAY_COLOR = '#c9a84c'
const SCALES = ['Day', 'Week', 'Month']

// ── Date helpers ──────────────────────────────────────
function toDate(str) { return str ? new Date(str + 'T00:00:00') : null }
function toISO(d) { return d.toISOString().slice(0, 10) }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

function startOfWeek(d) {
    const r = new Date(d)
    r.setDate(r.getDate() - r.getDay())
    return r
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }

function fmtMonth(d) { return d.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' }) }
function fmtDay(d) { return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) }
function fmtWeek(d) { return `Wk ${fmtDay(d)}` }

function daysBetween(a, b) {
    return Math.round((b - a) / 86400000)
}

// ── Build the time-scale columns ──────────────────────
// Returns array of { label, startDate, endDate, widthPx }
function buildColumns(viewStart, viewEnd, scale, pxPerDay) {
    const cols = []
    let cur = new Date(viewStart)

    if (scale === 'Day') {
        while (cur <= viewEnd) {
            const end = addDays(cur, 1)
            cols.push({ label: fmtDay(cur), startDate: new Date(cur), endDate: end, widthPx: pxPerDay })
            cur = end
        }
    } else if (scale === 'Week') {
        cur = startOfWeek(cur)
        while (cur <= viewEnd) {
            const end = addDays(cur, 7)
            cols.push({ label: fmtWeek(cur), startDate: new Date(cur), endDate: end, widthPx: pxPerDay * 7 })
            cur = end
        }
    } else { // Month
        cur = startOfMonth(cur)
        while (cur <= viewEnd) {
            const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
            const days = daysBetween(cur, end)
            cols.push({ label: fmtMonth(cur), startDate: new Date(cur), endDate: end, widthPx: pxPerDay * days })
            cur = end
        }
    }
    return cols
}

// px offset from viewStart for a given date
function dateToX(date, viewStart, pxPerDay) {
    return Math.max(0, daysBetween(viewStart, date) * pxPerDay)
}

// ── Phase status badge ────────────────────────────────
function StatusBadge({ status, small = false }) {
    const cfg = getStatusConfig(status)
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: small ? '1px 6px' : '2px 8px',
            borderRadius: 99, fontSize: small ? 10 : 11,
            fontWeight: 600, letterSpacing: 0.3,
            background: cfg.color + '22',
            color: cfg.color, border: `1px solid ${cfg.color}44`,
            whiteSpace: 'nowrap',
        }}>
            {cfg.label}
        </span>
    )
}

// ── Inline edit row ───────────────────────────────────
function PhaseEditRow({ phase, onSave, onCancel, onDelete, saving }) {
    const [form, setForm] = useState({
        name: phase.name || '',
        status: phase.status || 'not_started',
        start_date: phase.start_date || '',
        end_date: phase.end_date || '',
        assigned_to: phase.assigned_to || '',
        notes: phase.notes || '',
    })
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

    return (
        <div style={{
            background: '#faf8f5', border: '1px solid #e8e5de',
            borderRadius: 8, padding: '12px 14px', marginBottom: 6,
        }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 130px 130px', gap: 8, marginBottom: 8 }}>
                <div>
                    <label style={labelStyle}>Phase name</label>
                    <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Phase name" />
                </div>
                <div>
                    <label style={labelStyle}>Status</label>
                    <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
                        {PHASE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Start date</label>
                    <input style={inputStyle} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                </div>
                <div>
                    <label style={labelStyle}>End date</label>
                    <input style={inputStyle} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                    <label style={labelStyle}><User size={10} style={{ marginRight: 3 }} />Assigned to</label>
                    <input style={inputStyle} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="Name or role" />
                </div>
                <div>
                    <label style={labelStyle}><StickyNote size={10} style={{ marginRight: 3 }} />Notes</label>
                    <input style={inputStyle} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes" />
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    className="btn-primary"
                    style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={() => onSave(form)}
                    disabled={saving || !form.name || !form.start_date || !form.end_date}
                >
                    {saving ? <Loader size={12} className="ins-spin" /> : <Check size={12} />}
                    Save
                </button>
                <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={onCancel}>
                    <X size={12} /> Cancel
                </button>
                {phase.id && (
                    <button
                        className="btn-ghost"
                        style={{ fontSize: 12, padding: '5px 12px', color: '#dc2626', marginLeft: 'auto' }}
                        onClick={() => onDelete(phase.id)}
                    >
                        <Trash2 size={12} /> Delete phase
                    </button>
                )}
            </div>
        </div>
    )
}

const labelStyle = { display: 'block', fontSize: 10.5, color: '#aaa89f', marginBottom: 3, fontWeight: 500 }
const inputStyle = {
    width: '100%', padding: '5px 8px', fontSize: 12.5,
    border: '1px solid #e8e5de', borderRadius: 6,
    background: '#fff', color: '#1a1917', boxSizing: 'border-box',
}

// ── Main Gantt component ──────────────────────────────
export default function ProjectGanttTab({ project }) {
    const { phases, loading, error, addPhase, updatePhase, deletePhase, reorderPhases } = useProjectPhases(project?.id)

    const [scale, setScale] = useState('Month')
    const [editMode, setEditMode] = useState(false)
    const [editingId, setEditingId] = useState(null)   // phase id being edited, or 'new'
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState(null)
    const scrollRef = useRef(null)

    // Drag state for reordering
    const dragIdx = useRef(null)

    function showToast(msg, type = 'success') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 2500)
    }

    // ── View window ───────────────────────────────────
    // Derive view start/end from project dates + phases, with 1-col padding
    const { viewStart, viewEnd } = useMemo(() => {
        const dates = [
            project?.start_date && toDate(project.start_date),
            project?.end_date && toDate(project.end_date),
            ...phases.map(p => toDate(p.start_date)),
            ...phases.map(p => toDate(p.end_date)),
        ].filter(Boolean)

        const min = dates.length ? new Date(Math.min(...dates)) : new Date()
        const max = dates.length ? new Date(Math.max(...dates)) : addDays(new Date(), 30)

        // Pad by one unit on each side
        const pad = scale === 'Day' ? 3 : scale === 'Week' ? 7 : 30
        return {
            viewStart: addDays(min, -pad),
            viewEnd: addDays(max, pad),
        }
    }, [project, phases, scale])

    // px per day drives all positioning
    const pxPerDay = scale === 'Day' ? 40 : scale === 'Week' ? 20 : 8

    const columns = buildColumns(viewStart, viewEnd, scale, pxPerDay)
    const totalWidth = columns.reduce((s, c) => s + c.widthPx, 0)
    const today = new Date()
    const todayX = dateToX(today, viewStart, pxPerDay)

    // ── CRUD handlers ─────────────────────────────────
    async function handleSave(form) {
        setSaving(true)
        try {
            if (editingId === 'new') {
                await addPhase(form)
                showToast('Phase added.')
            } else {
                await updatePhase(editingId, form)
                showToast('Phase updated.')
            }
            setEditingId(null)
        } catch (e) { showToast(e.message, 'danger') }
        setSaving(false)
    }

    async function handleDelete(id) {
        setSaving(true)
        try {
            await deletePhase(id)
            setEditingId(null)
            showToast('Phase deleted.')
        } catch (e) { showToast(e.message, 'danger') }
        setSaving(false)
    }

    // ── Drag to reorder ───────────────────────────────
    function onDragStart(e, idx) { dragIdx.current = idx; e.dataTransfer.effectAllowed = 'move' }
    function onDragOver(e, idx) {
        e.preventDefault()
        if (dragIdx.current === null || dragIdx.current === idx) return
        const reordered = [...phases]
        const [moved] = reordered.splice(dragIdx.current, 1)
        reordered.splice(idx, 0, moved)
        dragIdx.current = idx
        reorderPhases(reordered)
    }
    function onDragEnd() { dragIdx.current = null }

    // ── Render ────────────────────────────────────────
    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <Loader size={20} className="ins-spin" style={{ color: '#c9a84c' }} />
        </div>
    )

    if (error) return (
        <div className="rc-error" style={{ marginTop: 16 }}>
            <AlertTriangle size={14} /> {error}
        </div>
    )

    const projectStart = project?.start_date ? toDate(project.start_date) : null
    const projectEnd = project?.end_date ? toDate(project.end_date) : null

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* ── Toolbar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0 14px', gap: 12, flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Scale switcher */}
                    <div style={{
                        display: 'flex', background: '#f0ede8',
                        borderRadius: 8, padding: 3, gap: 2,
                    }}>
                        {SCALES.map(s => (
                            <button
                                key={s}
                                onClick={() => setScale(s)}
                                style={{
                                    padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                    background: scale === s ? '#fff' : 'transparent',
                                    color: scale === s ? '#1a1917' : '#7a7872',
                                    boxShadow: scale === s ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* Edit mode toggle */}
                    <button
                        onClick={() => { setEditMode(s => !s); setEditingId(null) }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                            border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                            background: editMode ? '#1a1917' : '#fff',
                            color: editMode ? '#fff' : '#4a4844',
                            borderColor: editMode ? '#1a1917' : '#e8e5de',
                        }}
                    >
                        {editMode ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {editMode ? 'Edit mode on' : 'Edit mode off'}
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Legend */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {PHASE_STATUSES.map(s => (
                            <div key={s.value} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'block' }} />
                                <span style={{ fontSize: 11, color: '#7a7872' }}>{s.label}</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 2, height: 12, background: TODAY_COLOR, display: 'block', borderRadius: 1 }} />
                            <span style={{ fontSize: 11, color: '#7a7872' }}>Today</span>
                        </div>
                    </div>

                    {editMode && (
                        <button
                            className="btn-primary"
                            style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
                            onClick={() => setEditingId('new')}
                        >
                            <Plus size={13} /> Add phase
                        </button>
                    )}
                </div>
            </div>

            {/* ── New phase form ── */}
            {editMode && editingId === 'new' && (
                <PhaseEditRow
                    phase={{
                        start_date: project?.start_date || toISO(new Date()),
                        end_date: project?.end_date || toISO(addDays(new Date(), 14)),
                    }}
                    onSave={handleSave}
                    onCancel={() => setEditingId(null)}
                    onDelete={() => { }}
                    saving={saving}
                />
            )}

            {/* ── Empty state ── */}
            {phases.length === 0 && editingId !== 'new' && (
                <div style={{
                    textAlign: 'center', padding: '48px 24px',
                    background: '#faf8f5', borderRadius: 12,
                    border: '1px dashed #e8e5de',
                }}>
                    <CalendarDays size={32} strokeWidth={1} style={{ color: '#c9a84c', marginBottom: 12 }} />
                    <div style={{ fontWeight: 600, color: '#1a1917', marginBottom: 4 }}>No phases yet</div>
                    <div style={{ fontSize: 13, color: '#aaa89f', marginBottom: 16 }}>
                        Turn on Edit mode and add phases to build your Gantt chart.
                    </div>
                    {!editMode && (
                        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditMode(true)}>
                            Enable edit mode
                        </button>
                    )}
                </div>
            )}

            {/* ── Gantt chart ── */}
            {phases.length > 0 && (
                <div style={{ border: '1px solid #e8e5de', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                    <div style={{ display: 'flex' }}>

                        {/* ── Label column (fixed left) ── */}
                        <div style={{ width: LABEL_COL_W, flexShrink: 0, borderRight: '1px solid #e8e5de', zIndex: 2, background: '#fff' }}>
                            {/* Header cell */}
                            <div style={{
                                height: HEADER_H, display: 'flex', alignItems: 'flex-end',
                                padding: '0 14px 10px',
                                borderBottom: '2px solid #e8e5de',
                                background: '#faf8f5',
                            }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa89f', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Phase
                                </span>
                            </div>

                            {/* Phase label rows */}
                            {phases.map((phase, idx) => {
                                const cfg = getStatusConfig(phase.status)
                                const isEditing = editMode && editingId === phase.id
                                const isOverdue = phase.end_date < toISO(today) && phase.status !== 'done'

                                return (
                                    <div key={phase.id}>
                                        <div
                                            draggable={editMode}
                                            onDragStart={e => onDragStart(e, idx)}
                                            onDragOver={e => onDragOver(e, idx)}
                                            onDragEnd={onDragEnd}
                                            style={{
                                                height: ROW_H,
                                                display: 'flex', alignItems: 'center',
                                                padding: '0 10px',
                                                borderBottom: '1px solid #f0ede8',
                                                background: isEditing ? '#fdf9f0' : idx % 2 === 0 ? '#fff' : '#faf8f5',
                                                cursor: editMode ? 'grab' : 'default',
                                                gap: 6,
                                            }}
                                        >
                                            {editMode && (
                                                <GripVertical size={13} strokeWidth={1.5} style={{ color: '#ccc9c2', flexShrink: 0 }} />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: 12.5, fontWeight: 600,
                                                    color: isOverdue ? '#dc2626' : '#1a1917',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                }}>
                                                    {isOverdue && '⚠ '}{phase.name}
                                                </div>
                                                {phase.assigned_to && (
                                                    <div style={{ fontSize: 10.5, color: '#aaa89f', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                                                        <User size={9} strokeWidth={1.5} /> {phase.assigned_to}
                                                    </div>
                                                )}
                                            </div>
                                            <StatusBadge status={phase.status} small />
                                            {editMode && (
                                                <button
                                                    onClick={() => setEditingId(isEditing ? null : phase.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#aaa89f', flexShrink: 0 }}
                                                >
                                                    <Pencil size={12} strokeWidth={1.5} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Inline edit form below the row */}
                                        {isEditing && (
                                            <div style={{ padding: '8px 10px', borderBottom: '1px solid #e8e5de', background: '#fdf9f0' }}>
                                                <PhaseEditRow
                                                    phase={phase}
                                                    onSave={handleSave}
                                                    onCancel={() => setEditingId(null)}
                                                    onDelete={handleDelete}
                                                    saving={saving}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* ── Scrollable Gantt area ── */}
                        <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
                            {/* Total height = header + rows (accounting for open edit forms) */}
                            <div style={{ width: totalWidth, position: 'relative' }}>

                                {/* ── Time header ── */}
                                <div style={{
                                    height: HEADER_H, display: 'flex', alignItems: 'flex-end',
                                    borderBottom: '2px solid #e8e5de',
                                    background: '#faf8f5', position: 'sticky', top: 0, zIndex: 1,
                                }}>
                                    {columns.map((col, i) => (
                                        <div key={i} style={{
                                            width: col.widthPx, flexShrink: 0,
                                            borderRight: '1px solid #f0ede8',
                                            padding: '0 6px 10px',
                                            fontSize: 11, fontWeight: 600, color: '#7a7872',
                                            letterSpacing: 0.3,
                                            overflow: 'hidden', whiteSpace: 'nowrap',
                                        }}>
                                            {col.label}
                                        </div>
                                    ))}
                                </div>

                                {/* ── Rows ── */}
                                {phases.map((phase, idx) => {
                                    const cfg = getStatusConfig(phase.status)
                                    const isOverdue = phase.end_date < toISO(today) && phase.status !== 'done'
                                    const barColor = isOverdue ? '#dc2626' : cfg.color
                                    const isEditing = editMode && editingId === phase.id

                                    const phStart = toDate(phase.start_date)
                                    const phEnd = toDate(phase.end_date)
                                    const barX = dateToX(phStart, viewStart, pxPerDay)
                                    const barW = Math.max(8, daysBetween(phStart, phEnd) * pxPerDay)

                                    // Duration label
                                    const days = daysBetween(phStart, phEnd)
                                    const durLabel = days < 1 ? '1d' : days < 30 ? `${days}d` : days < 365 ? `${Math.round(days / 7)}w` : `${(days / 365).toFixed(1)}y`

                                    return (
                                        <div key={phase.id}>
                                            {/* Gantt row */}
                                            <div style={{
                                                height: ROW_H, position: 'relative',
                                                borderBottom: '1px solid #f0ede8',
                                                background: idx % 2 === 0 ? '#fff' : '#faf8f5',
                                            }}>
                                                {/* Vertical grid lines */}
                                                {columns.map((col, ci) => (
                                                    <div key={ci} style={{
                                                        position: 'absolute',
                                                        left: columns.slice(0, ci).reduce((s, c) => s + c.widthPx, 0),
                                                        top: 0, bottom: 0,
                                                        width: 1, background: '#f0ede8',
                                                    }} />
                                                ))}

                                                {/* Project background band */}
                                                {projectStart && projectEnd && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: dateToX(projectStart, viewStart, pxPerDay),
                                                        width: Math.max(0, daysBetween(projectStart, projectEnd) * pxPerDay),
                                                        top: 8, bottom: 8,
                                                        background: '#c9a84c0d',
                                                        borderLeft: '2px solid #c9a84c22',
                                                        borderRight: '2px solid #c9a84c22',
                                                        borderRadius: 3,
                                                    }} />
                                                )}

                                                {/* Phase bar */}
                                                <div
                                                    title={`${phase.name}\n${phase.start_date} → ${phase.end_date}${phase.notes ? '\n' + phase.notes : ''}`}
                                                    style={{
                                                        position: 'absolute',
                                                        left: barX, width: barW,
                                                        top: 10, height: ROW_H - 20,
                                                        background: barColor,
                                                        borderRadius: 5,
                                                        opacity: phase.status === 'done' ? 0.65 : 1,
                                                        display: 'flex', alignItems: 'center',
                                                        paddingLeft: 7, overflow: 'hidden',
                                                        boxShadow: `0 1px 4px ${barColor}44`,
                                                        cursor: 'default',
                                                        transition: 'opacity 0.15s',
                                                    }}
                                                >
                                                    {barW > 40 && (
                                                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', letterSpacing: 0.2 }}>
                                                            {durLabel}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Today line */}
                                                {today >= viewStart && today <= viewEnd && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: todayX, top: 0, bottom: 0,
                                                        width: 2, background: TODAY_COLOR,
                                                        zIndex: 2,
                                                    }} />
                                                )}
                                            </div>

                                            {/* Spacer when edit form is open (keeps Gantt aligned with label column) */}
                                            {isEditing && (
                                                <div style={{
                                                    borderBottom: '1px solid #e8e5de',
                                                    background: '#fdf9f0',
                                                    // Match the PhaseEditRow height — 2 rows of inputs + actions ≈ 138px
                                                    height: 138,
                                                }} />
                                            )}
                                        </div>
                                    )
                                })}

                                {/* Today line in header area */}
                                {today >= viewStart && today <= viewEnd && (
                                    <div style={{
                                        position: 'absolute',
                                        left: todayX, top: 0,
                                        width: 2, height: HEADER_H,
                                        background: TODAY_COLOR,
                                        zIndex: 3,
                                    }}>
                                        <div style={{
                                            position: 'absolute', top: 4, left: 4,
                                            background: TODAY_COLOR, color: '#fff',
                                            fontSize: 9, fontWeight: 700,
                                            padding: '1px 5px', borderRadius: 4,
                                            whiteSpace: 'nowrap',
                                        }}>
                                            Today
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Phase list summary (below chart) ── */}
            {phases.length > 0 && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa89f', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                        Phase Summary
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #e8e5de', borderRadius: 10, overflow: 'hidden' }}>
                        {phases.map((phase, idx) => {
                            const cfg = getStatusConfig(phase.status)
                            const isOverdue = phase.end_date < toISO(today) && phase.status !== 'done'
                            const days = daysBetween(toDate(phase.start_date), toDate(phase.end_date))

                            return (
                                <div key={phase.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 16px',
                                    background: idx % 2 === 0 ? '#fff' : '#faf8f5',
                                    borderBottom: idx < phases.length - 1 ? '1px solid #f0ede8' : 'none',
                                }}>
                                    <div style={{ width: 3, height: 32, borderRadius: 2, background: isOverdue ? '#dc2626' : cfg.color, flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13, color: isOverdue ? '#dc2626' : '#1a1917' }}>
                                            {isOverdue && '⚠ '}{phase.name}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#aaa89f', marginTop: 2 }}>
                                            {phase.start_date} → {phase.end_date} · {days < 1 ? '1 day' : `${days} days`}
                                            {phase.assigned_to && ` · ${phase.assigned_to}`}
                                        </div>
                                    </div>
                                    <StatusBadge status={phase.status} />
                                    {phase.notes && (
                                        <span title={phase.notes}>
                                            <StickyNote size={13} strokeWidth={1.5} style={{ color: '#c9a84c' }} />
                                        </span>
                                    )}
                                </div>
                            )
                        })}
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