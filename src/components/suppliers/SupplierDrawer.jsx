import { X, Mail, Phone, MapPin, Globe, Package, TrendingUp, Boxes, CalendarDays } from 'lucide-react'
import { useSupplierDetail } from '../../hooks/useSuppliers'

const STATUS_BADGE = {
    active: 'badge-green',
    discontinued: 'badge-red',
    pending: 'badge-yellow',
}

function formatPeso(amount, currency = 'PHP') {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency', currency,
        minimumFractionDigits: 2
    }).format(amount)
}

export default function SupplierDrawer({ supplierId, onClose, onEdit }) {
    const { supplier, resources, loading, error } = useSupplierDetail(supplierId)

    if (!supplierId) return null

    const totalValue = resources.reduce((sum, r) => sum + (r.unit_cost * (r.quantity || 0)), 0)
    const activeCount = resources.filter(r => r.status === 'active').length
    const capexCount = resources.filter(r => r.categories?.type === 'CAPEX').length
    const opexCount = resources.filter(r => r.categories?.type === 'OPEX').length

    return (
        <>
            {/* Backdrop */}
            <div className="drawer-backdrop" onClick={onClose} />

            {/* Drawer */}
            <div className="supplier-drawer">
                {/* Header */}
                <div className="drawer-header">
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                {loading && (
                    <div className="drawer-loading">
                        <div className="loading-spinner" />
                    </div>
                )}

                {error && (
                    <div className="drawer-error">{error}</div>
                )}

                {!loading && supplier && (
                    <>
                        {/* Supplier identity */}
                        <div className="drawer-identity">
                            <div className="drawer-avatar">
                                {supplier.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="drawer-identity-text">
                                <h2>{supplier.name}</h2>
                                <span className={`badge ${supplier.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                                    {supplier.status}
                                </span>
                            </div>
                            <button className="btn-ghost" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => onEdit(supplier)}>
                                Edit
                            </button>
                        </div>

                        {/* Description */}
                        {supplier.description && (
                            <p className="drawer-desc">{supplier.description}</p>
                        )}

                        {/* Contact info */}
                        <div className="drawer-contacts">
                            {supplier.contact_email && (
                                <a href={`mailto:${supplier.contact_email}`} className="drawer-contact-item">
                                    <Mail size={14} strokeWidth={1.5} />
                                    <span>{supplier.contact_email}</span>
                                </a>
                            )}
                            {supplier.phone && (
                                <a href={`tel:${supplier.phone}`} className="drawer-contact-item">
                                    <Phone size={14} strokeWidth={1.5} />
                                    <span>{supplier.phone}</span>
                                </a>
                            )}
                            {supplier.address && (
                                <div className="drawer-contact-item">
                                    <MapPin size={14} strokeWidth={1.5} />
                                    <span>{supplier.address}</span>
                                </div>
                            )}
                            {supplier.website && (
                                <a href={supplier.website} target="_blank" rel="noreferrer" className="drawer-contact-item">
                                    <Globe size={14} strokeWidth={1.5} />
                                    <span>{supplier.website}</span>
                                </a>
                            )}
                            {supplier.created_at && (
                                <div className="drawer-contact-item">
                                    <CalendarDays size={14} strokeWidth={1.5} />
                                    <span>Added {new Date(supplier.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                            )}
                        </div>

                        {/* Stats row */}
                        <div className="drawer-stats">
                            <div className="drawer-stat">
                                <Boxes size={16} strokeWidth={1.5} />
                                <div>
                                    <div className="drawer-stat-value">{resources.length}</div>
                                    <div className="drawer-stat-label">Total products</div>
                                </div>
                            </div>
                            <div className="drawer-stat">
                                <Package size={16} strokeWidth={1.5} />
                                <div>
                                    <div className="drawer-stat-value">{activeCount}</div>
                                    <div className="drawer-stat-label">Active</div>
                                </div>
                            </div>
                            <div className="drawer-stat">
                                <TrendingUp size={16} strokeWidth={1.5} />
                                <div>
                                    <div className="drawer-stat-value">{formatPeso(totalValue)}</div>
                                    <div className="drawer-stat-label">Total stock value</div>
                                </div>
                            </div>
                        </div>

                        {/* CAPEX / OPEX breakdown */}
                        {(capexCount > 0 || opexCount > 0) && (
                            <div className="drawer-breakdown">
                                {capexCount > 0 && (
                                    <div className="drawer-breakdown-item">
                                        <span className="badge badge-blue">{capexCount} CAPEX</span>
                                    </div>
                                )}
                                {opexCount > 0 && (
                                    <div className="drawer-breakdown-item">
                                        <span className="badge badge-purple">{opexCount} OPEX</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Products list */}
                        <div className="drawer-section-title">
                            Products from this supplier
                        </div>

                        {resources.length === 0 ? (
                            <div className="drawer-empty">
                                <Package size={28} strokeWidth={1} />
                                <p>No products yet</p>
                                <span>Resources linked to this supplier will appear here.</span>
                            </div>
                        ) : (
                            <div className="drawer-products">
                                {resources.map(r => (
                                    <div key={r.id} className="drawer-product-row">
                                        <div className="drawer-product-img">
                                            {r.image_url
                                                ? <img src={r.image_url} alt={r.name} />
                                                : <Package size={14} strokeWidth={1.5} />
                                            }
                                        </div>
                                        <div className="drawer-product-info">
                                            <span className="drawer-product-name">{r.name}</span>
                                            {r.categories && (
                                                <span className={`badge ${r.categories.type === 'CAPEX' ? 'badge-blue' : 'badge-purple'}`} style={{ fontSize: 10 }}>
                                                    {r.categories.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="drawer-product-right">
                                            <span className="drawer-product-cost">
                                                {formatPeso(r.unit_cost, r.currency)}
                                                {r.unit && <span style={{ fontWeight: 400, color: '#aaa89f', fontSize: 11 }}> {r.unit}</span>}
                                            </span>
                                            <span className={`badge ${STATUS_BADGE[r.status] || 'badge-gray'}`} style={{ fontSize: 10 }}>
                                                {r.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    )
}