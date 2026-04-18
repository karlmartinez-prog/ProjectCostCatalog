import {
    X, Package, Tag, Truck, CalendarDays,
    Hash, DollarSign, Layers, Pencil, TrendingUp, TrendingDown
} from 'lucide-react'

const STATUS_BADGE = {
    active: 'badge-green',
    pending: 'badge-yellow',
    discontinued: 'badge-red',
}

const CAPEX_STYLE = {
    CAPEX: 'badge-blue',
    OPEX: 'badge-purple',
}

function fmt(amount, currency = 'PHP') {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency', currency,
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount || 0)
}

function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-PH', {
        month: 'long', day: 'numeric', year: 'numeric',
    })
}

function timeAgo(date) {
    const diff = Date.now() - new Date(date)
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 30) return `${days} days ago`
    if (days < 365) return `${Math.floor(days / 30)} months ago`
    return `${Math.floor(days / 365)} years ago`
}

export default function ResourceDrawer({ resource, onClose, onEdit }) {
    if (!resource) return null

    const {
        name, image_url, unit_cost, currency, unit,
        status, quantity, categories, suppliers,
        created_at, procured_at, description,
    } = resource

    const stockValue = (unit_cost || 0) * (quantity || 0)

    return (
        <>
            {/* Backdrop */}
            <div className="drawer-backdrop" onClick={onClose} />

            {/* Drawer */}
            <div className="supplier-drawer">

                {/* Close button */}
                <div className="drawer-header">
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Image banner */}
                <div className="rd-image-banner">
                    {image_url
                        ? <img src={image_url} alt={name} />
                        : (
                            <div className="rd-image-placeholder">
                                <Package size={36} strokeWidth={1} />
                            </div>
                        )
                    }
                </div>

                {/* Identity */}
                <div className="drawer-identity" style={{ paddingTop: 16 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span className={`badge ${STATUS_BADGE[status] || 'badge-gray'}`}>{status}</span>
                            {categories && (
                                <span className={`badge ${CAPEX_STYLE[categories.type] || 'badge-gray'}`}>
                                    {categories.name} · {categories.type}
                                </span>
                            )}
                        </div>
                        <h2 style={{ fontSize: 19, fontWeight: 700, color: '#1a1917', letterSpacing: '-0.4px', margin: 0 }}>
                            {name}
                        </h2>
                    </div>
                    <button
                        className="btn-ghost"
                        style={{ marginLeft: 'auto', flexShrink: 0 }}
                        onClick={() => onEdit(resource)}
                    >
                        <Pencil size={13} strokeWidth={1.5} /> Edit
                    </button>
                </div>

                {/* Description */}
                {description && (
                    <p className="drawer-desc">{description}</p>
                )}

                {/* Stats row */}
                <div className="drawer-stats">
                    <div className="drawer-stat">
                        <DollarSign size={16} strokeWidth={1.5} />
                        <div>
                            <div className="drawer-stat-value">{fmt(unit_cost, currency)}</div>
                            <div className="drawer-stat-label">{unit ? `per ${unit}` : 'unit cost'}</div>
                        </div>
                    </div>
                    <div className="drawer-stat">
                        <Hash size={16} strokeWidth={1.5} />
                        <div>
                            <div className="drawer-stat-value">{quantity ?? 0}</div>
                            <div className="drawer-stat-label">in stock</div>
                        </div>
                    </div>
                    <div className="drawer-stat">
                        <Layers size={16} strokeWidth={1.5} />
                        <div>
                            <div className="drawer-stat-value">{fmt(stockValue, currency)}</div>
                            <div className="drawer-stat-label">stock value</div>
                        </div>
                    </div>
                </div>

                {/* Details list */}
                <div className="drawer-contacts" style={{ gap: 12 }}>
                    {suppliers && (
                        <div className="drawer-contact-item">
                            <Truck size={14} strokeWidth={1.5} />
                            <div>
                                <div style={{ fontSize: 11, color: '#aaa89f', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Supplier</div>
                                <div style={{ fontSize: 13.5, color: '#1a1917', fontWeight: 500 }}>{suppliers.name}</div>
                            </div>
                        </div>
                    )}

                    {categories && (
                        <div className="drawer-contact-item">
                            <Tag size={14} strokeWidth={1.5} />
                            <div>
                                <div style={{ fontSize: 11, color: '#aaa89f', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Category</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 13.5, color: '#1a1917', fontWeight: 500 }}>{categories.name}</span>
                                    <span className={`badge ${CAPEX_STYLE[categories.type] || 'badge-gray'}`} style={{ fontSize: 10 }}>
                                        {categories.type}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {currency && currency !== 'PHP' && (
                        <div className="drawer-contact-item">
                            <DollarSign size={14} strokeWidth={1.5} />
                            <div>
                                <div style={{ fontSize: 11, color: '#aaa89f', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Currency</div>
                                <div style={{ fontSize: 13.5, color: '#1a1917', fontWeight: 500 }}>{currency}</div>
                            </div>
                        </div>
                    )}

                    {procured_at && (
                        <div className="drawer-contact-item">
                            <CalendarDays size={14} strokeWidth={1.5} />
                            <div>
                                <div style={{ fontSize: 11, color: '#aaa89f', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Date procured</div>
                                <div style={{ fontSize: 13.5, color: '#1a1917', fontWeight: 500 }}>{formatDate(procured_at)}</div>
                            </div>
                        </div>
                    )}

                    <div className="drawer-contact-item">
                        <CalendarDays size={14} strokeWidth={1.5} />
                        <div>
                            <div style={{ fontSize: 11, color: '#aaa89f', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Added</div>
                            <div style={{ fontSize: 13.5, color: '#1a1917', fontWeight: 500 }}>
                                {formatDate(created_at)}
                                <span style={{ fontSize: 12, color: '#aaa89f', marginLeft: 6 }}>({timeAgo(created_at)})</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stock value callout */}
                <div className="rd-callout">
                    <div className="rd-callout-row">
                        {categories?.type === 'CAPEX'
                            ? <TrendingUp size={15} strokeWidth={1.5} style={{ color: '#2563eb' }} />
                            : <TrendingDown size={15} strokeWidth={1.5} style={{ color: '#8b5cf6' }} />
                        }
                        <div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1917' }}>
                                Total stock value
                            </div>
                            <div style={{ fontSize: 12, color: '#7a7872' }}>
                                {quantity ?? 0} {unit || 'units'} × {fmt(unit_cost, currency)}
                            </div>
                        </div>
                        <div style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 750, color: '#1a1917', letterSpacing: '-0.4px' }}>
                            {fmt(stockValue, currency)}
                        </div>
                    </div>
                </div>

            </div>
        </>
    )
}