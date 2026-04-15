import { Package, Pencil, Trash2 } from 'lucide-react'

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

export default function ResourceCard({ resource, onEdit, onDelete }) {
    const { name, image_url, unit_cost, currency, unit, status, quantity, categories, suppliers, created_at } = resource

    return (
        <div className="resource-card">
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
                        <button className="rc-btn" onClick={() => onEdit(resource)} title="Edit">
                            <Pencil size={14} strokeWidth={1.5} />
                        </button>
                        <button className="rc-btn rc-btn-danger" onClick={() => onDelete(resource)} title="Delete">
                            <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>

                <div className="rc-cost">
                    {formatPeso(unit_cost, currency)}
                    {unit && <span className="rc-unit"> {unit}</span>}
                </div>

                <div className="rc-meta">
                    {categories && (
                        <span className={`badge ${CAPEX_STYLE[categories.type] || 'badge-gray'}`}>
                            {categories.name}
                        </span>
                    )}
                    <span className={`badge ${STATUS_STYLE[status] || 'badge-gray'}`}>
                        {status}
                    </span>
                </div>

                <div className="rc-footer">
                    <span className="rc-supplier">{suppliers?.name ?? 'No supplier'}</span>
                    <span className="rc-detail">Qty: {quantity ?? 0}</span>
                    <span className="rc-detail">{timeAgo(created_at)}</span>
                </div>
            </div>
        </div>
    )
}