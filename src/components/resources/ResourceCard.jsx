import { Package, Pencil, Trash2, Eye, TrendingUp } from 'lucide-react'

const STATUS_STYLE = {
    active: 'badge-green',
    pending: 'badge-yellow',
    discontinued: 'badge-red',
}

const CAPEX_STYLE = {
    CAPEX: 'badge-blue',
    OPEX: 'badge-purple',
}

export function formatPeso(amount, currency = 'PHP') {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency', currency,
        minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(amount)
}

export function timeAgo(date) {
    const diff = Date.now() - new Date(date)
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 30) return `${days}d ago`
    if (days < 365) return `${Math.floor(days / 30)}mo ago`
    return `${Math.floor(days / 365)}y ago`
}

export default function ResourceCard({ resource, onEdit, onDelete, onClick, selected, inflationOn, adjustedCost }) {
    const { name, image_url, unit_cost, currency, unit, status, quantity, categories, suppliers, created_at, procured_at } = resource

    const showAdjusted = inflationOn && adjustedCost != null && adjustedCost !== unit_cost
    const displayCost = showAdjusted ? adjustedCost : unit_cost

    return (
        <div
            className={`resource-card ${selected ? 'rc-selected' : ''}`}
            onClick={onClick}
            style={{ cursor: 'pointer' }}
        >
            <div className="rc-image">
                {image_url
                    ? <img src={image_url} alt={name} />
                    : <div className="rc-image-empty"><Package size={22} strokeWidth={1.5} /></div>
                }
            </div>

            <div className="rc-body">
                <div className="rc-top">
                    <div className="rc-name">{name}</div>
                    <div className="rc-actions">
                        <button className="rc-btn" onClick={e => { e.stopPropagation(); onEdit(resource) }} title="Edit">
                            <Pencil size={14} strokeWidth={1.5} />
                        </button>
                        <button className="rc-btn rc-btn-danger" onClick={e => { e.stopPropagation(); onDelete(resource) }} title="Delete">
                            <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>

                <div className="rc-cost">
                    {formatPeso(displayCost, currency)}
                    {unit && <span className="rc-unit"> {unit}</span>}
                </div>

                {showAdjusted && (
                    <div className="rc-original-cost">
                        <TrendingUp size={10} strokeWidth={2} />
                        original: {formatPeso(unit_cost, currency)}
                    </div>
                )}

                <div className="rc-meta">
                    {categories && (
                        <span className={`badge ${CAPEX_STYLE[categories.type] || 'badge-gray'}`}>
                            {categories.name}
                        </span>
                    )}
                    <span className={`badge ${STATUS_STYLE[status] || 'badge-gray'}`}>
                        {status}
                    </span>
                    {showAdjusted && (
                        <span className="badge rc-inflation-badge">inflation-adjusted</span>
                    )}
                </div>

                <div className="rc-footer">
                    <span className="rc-supplier">{suppliers?.name ?? 'No supplier'}</span>
                    <span className="rc-detail">Qty: {quantity ?? 0}</span>
                    {procured_at
                        ? <span className="rc-detail rc-procured" title="Date procured">
                            🗓 {new Date(procured_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        : <span className="rc-detail">{timeAgo(created_at)}</span>
                    }
                </div>

                <div className="sp-click-hint" style={{ marginTop: 4 }}>
                    <Eye size={12} strokeWidth={1.5} />
                    <span>Click to view details</span>
                </div>
            </div>
        </div>
    )
}