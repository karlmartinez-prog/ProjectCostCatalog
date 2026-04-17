import { useNavigate } from 'react-router-dom'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart,
} from 'recharts'
import {
    FolderKanban, Package, Truck, TrendingUp, TrendingDown,
    ArrowRight, Boxes, DollarSign, Activity
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import './home.css'

// ── Helpers ──────────────────────────────────────────
function fmt(amount, currency = 'PHP', compact = false) {
    if (compact) {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency', currency,
            notation: 'compact', maximumFractionDigits: 1,
        }).format(amount || 0)
    }
    return new Intl.NumberFormat('en-PH', {
        style: 'currency', currency,
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount || 0)
}

function timeAgo(date) {
    const diff = Date.now() - new Date(date)
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 30) return `${days}d ago`
    return new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

const STATUS_COLORS = {
    planned: '#aaa89f',
    ongoing: '#8b5cf6',
    completed: '#2563eb',
    cancelled: '#dc2626',
    active: '#16a34a',
    discontinued: '#dc2626',
    pending: '#d97706',
}

// ── Skeleton ─────────────────────────────────────────
function Skeleton({ w = '100%', h = 20, r = 6 }) {
    return (
        <div style={{
            width: w, height: h, borderRadius: r,
            background: 'linear-gradient(90deg,#f0ede8 25%,#e8e5e0 50%,#f0ede8 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
        }} />
    )
}

// ── Custom tooltip ────────────────────────────────────
function ChartTooltip({ active, payload, label, currency = 'PHP' }) {
    if (!active || !payload?.length) return null
    return (
        <div className="chart-tooltip">
            {label && <div className="chart-tooltip-label">{label}</div>}
            {payload.map((p, i) => (
                <div key={i} className="chart-tooltip-row">
                    <span className="chart-tooltip-dot" style={{ background: p.fill || p.color }} />
                    <span>{p.name}: <strong>{fmt(p.value, currency)}</strong></span>
                </div>
            ))}
        </div>
    )
}

// ── KPI Card ──────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent, loading, style }) {
    return (
        <div className="kpi-card" style={style}>
            <div className="kpi-card-top">
                <span className="kpi-label">{label}</span>
                <div className="kpi-icon" style={{ background: accent + '18', color: accent }}>
                    <Icon size={15} strokeWidth={1.5} />
                </div>
            </div>
            <div className="kpi-value">
                {loading ? <Skeleton w={100} h={28} /> : value}
            </div>
            {sub && (
                <div className="kpi-sub">
                    {loading ? <Skeleton w={80} h={14} /> : sub}
                </div>
            )}
        </div>
    )
}

// ── Main ──────────────────────────────────────────────
export default function Home() {
    const navigate = useNavigate()
    const { stats, recentActivity, capexOpexData, monthlyCostData, projectCostData, loading } = useDashboard()

    const now = new Date()
    const hour = now.getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

    return (
        <div className="home-page">

            {/* ── Welcome strip ── */}
            <div className="home-welcome">
                <div>
                    <h2 className="home-greeting">{greeting} 👋</h2>
                    <p className="home-date">
                        {now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                </div>
                <div className="home-welcome-actions">
                    <button className="btn-ghost" onClick={() => navigate('/projects')}>
                        <FolderKanban size={14} strokeWidth={1.5} /> View projects
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/resources')}>
                        <Package size={14} strokeWidth={1.5} /> Resource catalog
                    </button>
                </div>
            </div>

            {/* ── KPI row ── */}
            <div className="kpi-grid">
                <KpiCard
                    label="Total projects"
                    value={stats?.totalProjects ?? 0}
                    sub={`${stats?.activeProjects ?? 0} ongoing`}
                    icon={FolderKanban}
                    accent="#8b5cf6"
                    loading={loading}
                    style={{ animationDelay: '0ms' }}
                />
                <KpiCard
                    label="Total resources"
                    value={stats?.totalResources ?? 0}
                    sub={`${stats?.activeResources ?? 0} active`}
                    icon={Package}
                    accent="#2563eb"
                    loading={loading}
                    style={{ animationDelay: '60ms' }}
                />
                <KpiCard
                    label="Suppliers"
                    value={stats?.totalSuppliers ?? 0}
                    sub={`${stats?.activeSuppliers ?? 0} active`}
                    icon={Truck}
                    accent="#16a34a"
                    loading={loading}
                    style={{ animationDelay: '120ms' }}
                />
                <KpiCard
                    label="Total project cost"
                    value={loading ? null : fmt(stats?.totalProjectCost, 'PHP', true)}
                    sub="across all projects"
                    icon={DollarSign}
                    accent="#c9a84c"
                    loading={loading}
                    style={{ animationDelay: '180ms' }}
                />
                <KpiCard
                    label="CAPEX (all time)"
                    value={loading ? null : fmt(stats?.totalCapex, 'PHP', true)}
                    sub={`${fmt(stats?.capexThisYear, 'PHP', true)} this year`}
                    icon={TrendingUp}
                    accent="#2563eb"
                    loading={loading}
                    style={{ animationDelay: '240ms' }}
                />
                <KpiCard
                    label="OPEX (all time)"
                    value={loading ? null : fmt(stats?.totalOpex, 'PHP', true)}
                    sub={`${fmt(stats?.opexThisYear, 'PHP', true)} this year`}
                    icon={TrendingDown}
                    accent="#8b5cf6"
                    loading={loading}
                    style={{ animationDelay: '300ms' }}
                />
            </div>

            {/* ── Charts row ── */}
            <div className="home-charts-grid">

                {/* Monthly cost trend */}
                <div className="chart-card chart-card-wide">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">
                                <Activity size={14} strokeWidth={1.5} /> Monthly cost trend
                            </div>
                            <div className="chart-card-sub">CAPEX & OPEX over the last 8 months</div>
                        </div>
                    </div>
                    {loading ? (
                        <div className="chart-skeleton"><Skeleton w="100%" h={200} r={8} /></div>
                    ) : monthlyCostData.every(m => m.capex === 0 && m.opex === 0) ? (
                        <div className="chart-empty">No cost data yet</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={monthlyCostData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="capexGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="opexGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#aaa89f' }} axisLine={false} tickLine={false} />
                                <YAxis
                                    tick={{ fontSize: 11, fill: '#aaa89f' }}
                                    axisLine={false} tickLine={false}
                                    tickFormatter={v => fmt(v, 'PHP', true)}
                                    width={56}
                                />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="capex" name="CAPEX" stroke="#2563eb" strokeWidth={2}
                                    fill="url(#capexGrad)" dot={false} activeDot={{ r: 4, fill: '#2563eb' }} />
                                <Area type="monotone" dataKey="opex" name="OPEX" stroke="#8b5cf6" strokeWidth={2}
                                    fill="url(#opexGrad)" dot={false} activeDot={{ r: 4, fill: '#8b5cf6' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                    <div className="chart-legend">
                        <div className="chart-legend-item"><span style={{ background: '#2563eb' }} />CAPEX</div>
                        <div className="chart-legend-item"><span style={{ background: '#8b5cf6' }} />OPEX</div>
                    </div>
                </div>

                {/* CAPEX vs OPEX pie */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">
                                <Boxes size={14} strokeWidth={1.5} /> CAPEX vs OPEX
                            </div>
                            <div className="chart-card-sub">All-time cost type split</div>
                        </div>
                    </div>
                    {loading ? (
                        <div className="chart-skeleton"><Skeleton w="100%" h={200} r={8} /></div>
                    ) : capexOpexData.length === 0 ? (
                        <div className="chart-empty">No tagged line items yet</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={capexOpexData}
                                    cx="50%" cy="50%"
                                    innerRadius={54} outerRadius={80}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {capexOpexData.map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v) => fmt(v, 'PHP')} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                    {!loading && capexOpexData.length > 0 && (
                        <div className="pie-legend">
                            {capexOpexData.map((d, i) => {
                                const total = capexOpexData.reduce((s, x) => s + x.value, 0)
                                return (
                                    <div key={i} className="pie-legend-item">
                                        <span className="pie-legend-dot" style={{ background: d.fill }} />
                                        <div>
                                            <div className="pie-legend-name">{d.name}</div>
                                            <div className="pie-legend-val">
                                                {fmt(d.value, 'PHP', true)}
                                                <span className="pie-legend-pct"> · {((d.value / total) * 100).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Project cost comparison ── */}
            <div className="chart-card" style={{ animationDelay: '100ms' }}>
                <div className="chart-card-header">
                    <div>
                        <div className="chart-card-title">
                            <FolderKanban size={14} strokeWidth={1.5} /> Project cost comparison
                        </div>
                        <div className="chart-card-sub">Top 8 projects by total cost</div>
                    </div>
                    <button className="chart-card-link" onClick={() => navigate('/projects')}>
                        View all <ArrowRight size={13} strokeWidth={1.5} />
                    </button>
                </div>
                {loading ? (
                    <div className="chart-skeleton"><Skeleton w="100%" h={200} r={8} /></div>
                ) : projectCostData.length === 0 ? (
                    <div className="chart-empty">No projects with costs yet</div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={projectCostData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" horizontal={false} />
                            <XAxis
                                type="number"
                                tick={{ fontSize: 11, fill: '#aaa89f' }}
                                axisLine={false} tickLine={false}
                                tickFormatter={v => fmt(v, 'PHP', true)}
                            />
                            <YAxis
                                type="category" dataKey="name"
                                tick={{ fontSize: 11, fill: '#4a4844' }}
                                axisLine={false} tickLine={false}
                                width={130}
                            />
                            <Tooltip
                                formatter={v => [fmt(v, 'PHP'), 'Cost']}
                                cursor={{ fill: 'rgba(201,168,76,0.06)' }}
                            />
                            <Bar dataKey="cost" radius={[0, 4, 4, 0]} maxBarSize={18}>
                                {projectCostData.map((entry, i) => (
                                    <Cell
                                        key={i}
                                        fill={STATUS_COLORS[entry.status] || '#c9a84c'}
                                        fillOpacity={0.85}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
                {!loading && projectCostData.length > 0 && (
                    <div className="chart-legend" style={{ marginTop: 8 }}>
                        {['ongoing', 'completed', 'planned', 'cancelled'].map(s => (
                            <div key={s} className="chart-legend-item">
                                <span style={{ background: STATUS_COLORS[s] }} />{s.charAt(0).toUpperCase() + s.slice(1)}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Bottom row: Recent activity ── */}
            <div className="home-bottom-grid">
                <div className="card home-activity">
                    <div className="chart-card-header" style={{ marginBottom: 4 }}>
                        <div className="chart-card-title">
                            <Activity size={14} strokeWidth={1.5} /> Recent activity
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="chart-card-link" onClick={() => navigate('/resources')}>
                                Resources <ArrowRight size={13} strokeWidth={1.5} />
                            </button>
                            <button className="chart-card-link" onClick={() => navigate('/projects')}>
                                Projects <ArrowRight size={13} strokeWidth={1.5} />
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <Skeleton w={36} h={36} r={8} />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <Skeleton w="60%" h={13} />
                                        <Skeleton w="40%" h={11} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : recentActivity.length === 0 ? (
                        <div className="chart-empty" style={{ marginTop: 24 }}>No activity yet</div>
                    ) : (
                        <div className="activity-list">
                            {recentActivity.map((item, i) => (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    className="activity-row"
                                    style={{ animationDelay: `${i * 40}ms` }}
                                    onClick={() => item.type === 'project' && navigate(`/projects/${item.id}`)}
                                    role={item.type === 'project' ? 'button' : undefined}
                                >
                                    <div className={`activity-icon activity-icon-${item.type}`}>
                                        {item.type === 'project'
                                            ? <FolderKanban size={14} strokeWidth={1.5} />
                                            : <Package size={14} strokeWidth={1.5} />
                                        }
                                    </div>
                                    <div className="activity-info">
                                        <div className="activity-name">{item.name}</div>
                                        <div className="activity-meta">
                                            <span className="activity-type-badge">
                                                {item.type === 'project' ? 'Project' : item.meta || 'Resource'}
                                            </span>
                                            <span
                                                className="activity-status-dot"
                                                style={{ background: STATUS_COLORS[item.status] || '#aaa89f' }}
                                            />
                                            <span>{item.status}</span>
                                        </div>
                                    </div>
                                    <div className="activity-right">
                                        <div className="activity-cost">
                                            {item.cost > 0 ? fmt(item.cost, item.currency || 'PHP', true) : '—'}
                                        </div>
                                        <div className="activity-time">{timeAgo(item.createdAt)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick stats sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Project status breakdown */}
                    <div className="card home-mini-card">
                        <div className="chart-card-title" style={{ marginBottom: 14 }}>
                            <FolderKanban size={14} strokeWidth={1.5} /> Projects by status
                        </div>
                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[80, 60, 90, 50].map((w, i) => <Skeleton key={i} w={`${w}%`} h={12} />)}
                            </div>
                        ) : (
                            <div className="status-breakdown">
                                {['ongoing', 'completed', 'planned', 'cancelled'].map(s => {
                                    const count = recentActivity.filter(a => a.type === 'project' && a.status === s).length
                                    return (
                                        <div key={s} className="status-breakdown-row"
                                            onClick={() => navigate('/projects')}>
                                            <div className="status-breakdown-dot" style={{ background: STATUS_COLORS[s] }} />
                                            <span className="status-breakdown-label">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                                            <span className="status-breakdown-count">{count}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        <button className="home-mini-link" onClick={() => navigate('/projects')}>
                            View all projects <ArrowRight size={12} strokeWidth={1.5} />
                        </button>
                    </div>

                    {/* Quick nav */}
                    <div className="card home-mini-card">
                        <div className="chart-card-title" style={{ marginBottom: 14 }}>
                            <Boxes size={14} strokeWidth={1.5} /> Quick navigate
                        </div>
                        <div className="quick-nav-grid">
                            {[
                                { label: 'Projects', icon: FolderKanban, to: '/projects', color: '#8b5cf6' },
                                { label: 'Resources', icon: Package, to: '/resources', color: '#2563eb' },
                                { label: 'Suppliers', icon: Truck, to: '/suppliers', color: '#16a34a' },
                                { label: 'Insights', icon: Activity, to: '/insights', color: '#c9a84c' },
                            ].map(({ label, icon: Icon, to, color }) => (
                                <button key={to} className="quick-nav-btn" onClick={() => navigate(to)}>
                                    <div className="quick-nav-icon" style={{ background: color + '18', color }}>
                                        <Icon size={16} strokeWidth={1.5} />
                                    </div>
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}