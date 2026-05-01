import { useState } from 'react'
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
    TrendingUp, Sparkles, RefreshCw, AlertTriangle,
    Loader, BarChart3, Activity, Settings2, Trash2
} from 'lucide-react'
import { useInsights, useInflationRates, getPresetRate } from '../hooks/useInsights'
import { estimateProjectCost, suggestInflationRates } from '../services/aiEstimator'
import './insights.css'

const PROJECT_TYPES = [
    'Core Network Upgrade',
    'Site Facilities Improvement',
    'Fiber / Passive Infrastructure Rollout',
    'Power and Energy System Installation',
    'Cooling System Upgrade',
    'Physical Security System Installation',
    'Transmission Node Deployment',
    'Data Center / Equipment Room Build-out',
    'Civil and Structural Works',
    'Network Active Equipment Deployment',
    'Preventive Maintenance Program',
    'Software / NMS Platform Deployment',
    'Other',
]

const CURRENCIES = ['PHP', 'USD', 'EUR']

function fmt(v, currency = 'PHP', compact = false) {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency', currency,
        notation: compact ? 'compact' : 'standard',
        minimumFractionDigits: compact ? 0 : 2,
        maximumFractionDigits: compact ? 1 : 2,
    }).format(v || 0)
}

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
        <div className="ins-tooltip">
            {label && <div className="ins-tooltip-label">{label}</div>}
            {payload.map((p, i) => (
                <div key={i} className="ins-tooltip-row">
                    <span className="ins-tooltip-dot" style={{ background: p.color || p.fill }} />
                    <span>{p.name}: <strong>{fmt(p.value)}</strong></span>
                </div>
            ))}
        </div>
    )
}

function SectionHeader({ icon: Icon, title, sub }) {
    return (
        <div className="ins-section-header">
            <div className="ins-section-icon"><Icon size={16} strokeWidth={1.5} /></div>
            <div>
                <div className="ins-section-title">{title}</div>
                {sub && <div className="ins-section-sub">{sub}</div>}
            </div>
        </div>
    )
}

function EmptyChart({ msg = 'No data yet' }) {
    return <div className="ins-chart-empty">{msg}</div>
}

function Skeleton({ h = 200 }) {
    return (
        <div style={{
            height: h, borderRadius: 8,
            background: 'linear-gradient(90deg,#f0ede8 25%,#e8e5e0 50%,#f0ede8 75%)',
            backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
        }} />
    )
}

// ── AI Estimator ──────────────────────────────────────
function AiEstimator({ categories }) {
    const [form, setForm] = useState({
        projectType: '', location: '', size: '', duration: '',
        currency: 'PHP', notes: '',
    })
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

    async function handleEstimate() {
        if (!form.projectType) return setError('Please select a project type.')
        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const parsed = await estimateProjectCost(form, categories)
            setResult(parsed)
        } catch (err) {
            setError(err.message || 'Failed to get estimate. Please try again.')
        }

        setLoading(false)
    }

    return (
        <div className="ins-card">
            <SectionHeader
                icon={Sparkles}
                title="AI Project Cost Estimator"
                sub="Describe your project and get a cost breakdown with low / mid / high range"
            />

            <div className="ins-estimator-form">
                <div className="ins-form-grid">
                    <div className="mf-group">
                        <label>Project type *</label>
                        <select value={form.projectType} onChange={e => set('projectType', e.target.value)}>
                            <option value="">Select type…</option>
                            {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="mf-group">
                        <label>Currency</label>
                        <select value={form.currency} onChange={e => set('currency', e.target.value)}>
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="mf-group">
                        <label>Location</label>
                        <input value={form.location} onChange={e => set('location', e.target.value)}
                            placeholder="e.g. Naga City, Camarines Sur" />
                    </div>
                    <div className="mf-group">
                        <label>Size / scope</label>
                        <input value={form.size} onChange={e => set('size', e.target.value)}
                            placeholder="e.g. 3 sites, 2km fiber, 1 equipment room" />
                    </div>
                    <div className="mf-group">
                        <label>Estimated duration</label>
                        <input value={form.duration} onChange={e => set('duration', e.target.value)}
                            placeholder="e.g. 3 months, Jan–Mar 2025" />
                    </div>
                </div>

                <div className="mf-group">
                    <label>Additional notes / requirements</label>
                    <textarea
                        value={form.notes}
                        onChange={e => set('notes', e.target.value)}
                        placeholder="Any specific requirements, special conditions, equipment brands, site access constraints, etc."
                        rows={3}
                    />
                </div>

                {error && (
                    <div className="ins-error">
                        <AlertTriangle size={14} /> {error}
                    </div>
                )}

                <button
                    className="btn-primary ins-estimate-btn"
                    onClick={handleEstimate}
                    disabled={loading}
                >
                    {loading
                        ? <><Loader size={14} className="ins-spin" /> Estimating…</>
                        : <><Sparkles size={14} /> Estimate project cost</>
                    }
                </button>
            </div>

            {result && (
                <div className="ins-result">
                    <div className="ins-result-summary">{result.summary}</div>

                    <div className="ins-range-strip">
                        <div className="ins-range-card ins-range-low">
                            <div className="ins-range-label">Low estimate</div>
                            <div className="ins-range-value">{fmt(result.low, result.currency)}</div>
                            <div className="ins-range-hint">Conservative scenario</div>
                        </div>
                        <div className="ins-range-card ins-range-mid">
                            <div className="ins-range-label">Mid estimate</div>
                            <div className="ins-range-value">{fmt(result.mid, result.currency)}</div>
                            <div className="ins-range-hint">Most likely</div>
                        </div>
                        <div className="ins-range-card ins-range-high">
                            <div className="ins-range-label">High estimate</div>
                            <div className="ins-range-value">{fmt(result.high, result.currency)}</div>
                            <div className="ins-range-hint">Worst case</div>
                        </div>
                    </div>

                    <div className="ins-breakdown-title">Cost breakdown by category</div>
                    <div className="ins-breakdown-table-wrap">
                        <table className="rc-table">
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th>Type</th>
                                    <th style={{ textAlign: 'right' }}>Low</th>
                                    <th style={{ textAlign: 'right' }}>Mid</th>
                                    <th style={{ textAlign: 'right' }}>High</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.breakdown.map((row, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 500 }}>{row.category}</td>
                                        <td>
                                            <span className={`badge ${row.type === 'CAPEX' ? 'badge-blue' : 'badge-purple'}`}>
                                                {row.type}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#7a7872' }}>{fmt(row.low, result.currency)}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 650 }}>{fmt(row.mid, result.currency)}</td>
                                        <td style={{ textAlign: 'right', color: '#7a7872' }}>{fmt(row.high, result.currency)}</td>
                                        <td style={{ fontSize: 12, color: '#9a9790' }}>{row.note}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {result.assumptions?.length > 0 && (
                        <div className="ins-assumptions">
                            <div className="ins-assumptions-title">Key assumptions</div>
                            <ul className="ins-assumptions-list">
                                {result.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                        </div>
                    )}

                    <button className="btn-ghost ins-reset-btn" onClick={() => setResult(null)}>
                        <RefreshCw size={13} /> New estimate
                    </button>
                </div>
            )}
        </div>
    )
}

// ── Inflation Rates Manager ───────────────────────────
function InflationManager({ categories }) {
    const { rates, loading, upsertRate, deleteRate } = useInflationRates()
    const [saving, setSaving] = useState(null)
    const [suggesting, setSuggesting] = useState(false)
    const [suggestions, setSuggestions] = useState([])
    const [suggestError, setSuggestError] = useState(null)
    const currentYear = new Date().getFullYear()
    const years = [currentYear - 3, currentYear - 2, currentYear - 1, currentYear]

    async function handleSuggest() {
        setSuggesting(true)
        setSuggestError(null)
        try {
            const result = await suggestInflationRates(categories)
            setSuggestions(result)
        } catch (err) {
            setSuggestError(err.message)
        }
        setSuggesting(false)
    }

    function getSuggestedRate(categoryName, year) {
        const match = suggestions.find(s =>
            s.category_name.toLowerCase() === categoryName.toLowerCase()
        )
        return match?.rates?.[year] ?? null
    }

    async function handleAcceptAll() {
        const updates = categories.flatMap(cat =>
            years
                .map(year => ({ cat, year, rate: getSuggestedRate(cat.name, year) }))
                .filter(({ rate }) => rate !== null)
                .map(({ cat, year, rate }) => upsertRate(cat.id, year, rate))
        )
        await Promise.all(updates)
        setSuggestions([])
    }

    return (
        <div className="ins-card">
            <SectionHeader
                icon={Settings2}
                title="Inflation Rates Manager"
                sub="Manage category-specific annual inflation rates"
            />
            <div className="ins-inflation-actions">
                <p className="ins-section-sub">
                    Set annual inflation percentages per category. These rates drive the "Current Price" calculations in your Project Detail views.
                </p>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button
                        className="btn-ghost"
                        onClick={handleSuggest}
                        disabled={suggesting}
                    >
                        {suggesting ? <Loader size={13} className="ins-spin" /> : <Sparkles size={13} />}
                        {suggesting ? 'Fetching AI Suggestions...' : 'Suggest Rates with AI'}
                    </button>
                    {suggestions.length > 0 && (
                        <button className="btn-primary" onClick={handleAcceptAll}>
                            Accept All Suggestions
                        </button>
                    )}
                </div>
            </div>

            {suggestError && <div className="ins-error" style={{ marginTop: 12 }}>{suggestError}</div>}

            <div className="ins-inflation-table-wrap">
                <table className="rc-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            {years.map(y => <th key={y} style={{ textAlign: 'center' }}>{y}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map(cat => (
                            <tr key={cat.id}>
                                <td style={{ fontWeight: 500 }}>
                                    {cat.name}
                                    <div style={{ fontSize: 10, color: '#aaa89f', textTransform: 'uppercase' }}>{cat.type}</div>
                                </td>
                                {years.map(year => {
                                    const rateObj = rates.find(r => r.category_id === cat.id && r.year === year)
                                    const currentRate = rateObj?.rate ?? 0   // ← .rate (normalized alias)
                                    const suggested = getSuggestedRate(cat.name, year)
                                    const isSaving = saving === `${cat.id}-${year}`

                                    return (
                                        <td key={year} style={{ textAlign: 'center', position: 'relative' }}>
                                            <div className="ins-rate-input-wrapper">
                                                <input
                                                    type="number"
                                                    className={`ins-rate-input ${suggested !== null ? 'has-suggestion' : ''}`}
                                                    value={currentRate}              // ← controlled input
                                                    step="0.1"
                                                    onChange={async (e) => {
                                                        const val = parseFloat(e.target.value)
                                                        if (isNaN(val)) return
                                                        setSaving(`${cat.id}-${year}`)
                                                        await upsertRate(cat.id, year, val)
                                                        setSaving(null)
                                                    }}
                                                />
                                                <span className="ins-percent-symbol">%</span>
                                                {isSaving && <Loader size={10} className="ins-spin ins-rate-loader" />}
                                            </div>

                                            {suggested !== null && suggested !== currentRate && (
                                                <button
                                                    className="ins-suggestion-badge"
                                                    onClick={() => upsertRate(cat.id, year, suggested)}
                                                    title={`AI suggests ${suggested}% based on market trends`}
                                                >
                                                    AI: {suggested}%
                                                </button>
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────
export default function Insights() {
    const { costHistory, categories, quarterlyData, categorySpend, loading, error } = useInsights(4)
    const [selectedHistoryRes, setSelectedHistoryRes] = useState(0)

    if (error) return (
        <div className="rc-error" style={{ marginTop: 24 }}>
            <AlertTriangle size={15} /> {error}
        </div>
    )

    const hasQuarterly = quarterlyData.some(q => q.total > 0)
    const hasCategorySpend = categorySpend.length > 0

    const historyByResource = {}
    for (const h of costHistory) {
        const name = h.resources?.name || 'Unknown'
        if (!historyByResource[name]) historyByResource[name] = []
        historyByResource[name].push({
            date: new Date(h.effective_date).toLocaleDateString('en-PH', { month: 'short', year: '2-digit' }),
            cost: h.new_cost,
            old: h.old_cost,
        })
    }
    const historyResources = Object.keys(historyByResource)
    const historyData = historyResources.length > 0
        ? historyByResource[historyResources[selectedHistoryRes]] || []
        : []

    const CHART_COLORS = ['#2563eb', '#8b5cf6', '#c9a84c', '#16a34a', '#dc2626', '#0891b2', '#ea580c']

    return (
        <div className="ins-page">
            <div className="page-header">
                <div className="page-header-text">
                    <h2>Business Insights</h2>
                    <p>Cost trends, inflation rates, and AI-powered project estimation.</p>
                </div>
            </div>

            {/* ── Quarterly spend trend ── */}
            <div className="ins-card">
                <SectionHeader
                    icon={Activity}
                    title="Quarterly Cost Trend"
                    sub="CAPEX & OPEX spend across the last 4 quarters"
                />
                {loading ? <Skeleton /> : !hasQuarterly ? <EmptyChart msg="No project resource costs tagged yet" /> : (
                    <>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={quarterlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#aaa89f' }} axisLine={false} tickLine={false} />
                                <YAxis
                                    tick={{ fontSize: 11, fill: '#aaa89f' }} axisLine={false} tickLine={false}
                                    tickFormatter={v => fmt(v, 'PHP', true)} width={60}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,76,0.05)' }} />
                                <Bar dataKey="capex" name="CAPEX" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="opex" name="OPEX" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="ins-legend">
                            <div className="ins-legend-item"><span style={{ background: '#2563eb' }} /> CAPEX</div>
                            <div className="ins-legend-item"><span style={{ background: '#8b5cf6' }} /> OPEX</div>
                        </div>
                    </>
                )}
            </div>

            {/* ── Two-col row ── */}
            <div className="ins-two-col">

                {/* Category spend */}
                <div className="ins-card">
                    <SectionHeader
                        icon={BarChart3}
                        title="Spend by Category"
                        sub="Total project resource costs grouped by category"
                    />
                    {loading ? <Skeleton /> : !hasCategorySpend ? <EmptyChart /> : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart
                                data={categorySpend.slice(0, 7)}
                                layout="vertical"
                                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: '#aaa89f' }} axisLine={false} tickLine={false}
                                    tickFormatter={v => fmt(v, 'PHP', true)} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#4a4844' }}
                                    axisLine={false} tickLine={false} width={110} />
                                <Tooltip formatter={v => [fmt(v), 'Spend']} cursor={{ fill: 'rgba(201,168,76,0.05)' }} />
                                <Bar dataKey="total" name="Spend" radius={[0, 4, 4, 0]} maxBarSize={18}>
                                    {categorySpend.slice(0, 7).map((_, i) => (
                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Resource price history */}
                <div className="ins-card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                        <SectionHeader
                            icon={TrendingUp}
                            title="Resource Price History"
                            sub="Cost changes over time from cost_history"
                        />
                        {historyResources.length > 1 && (
                            <select
                                className="ins-res-select"
                                value={selectedHistoryRes}
                                onChange={e => setSelectedHistoryRes(parseInt(e.target.value))}
                            >
                                {historyResources.map((name, i) => (
                                    <option key={i} value={i}>{name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {loading ? <Skeleton /> : historyResources.length === 0 ? (
                        <EmptyChart msg="No price change history yet. Edit a resource's unit cost to start tracking." />
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={historyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#c9a84c" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#c9a84c" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#aaa89f' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#aaa89f' }} axisLine={false} tickLine={false}
                                    tickFormatter={v => fmt(v, 'PHP', true)} width={60} />
                                <Tooltip formatter={v => [fmt(v), 'Unit cost']} />
                                <Line
                                    type="monotone" dataKey="cost" name="Unit cost"
                                    stroke="#c9a84c" strokeWidth={2.5}
                                    dot={{ fill: '#c9a84c', r: 4, strokeWidth: 0 }}
                                    activeDot={{ r: 6, fill: '#c9a84c' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── AI Estimator ── */}
            <AiEstimator categories={categories} />

            {/* ── Inflation rates manager ── */}
            <InflationManager categories={categories} />
        </div>
    )
}