import { useState, useRef } from 'react'
import {
    User, Tag, Camera, Pencil, Trash2, Plus,
    AlertTriangle, X, Check, Shield, Loader
} from 'lucide-react'
import { useProfile, useCategories } from '../hooks/useSettings'
import CategoryModal from '../components/settings/CategoryModal'
import './settings.css'


const ROLES = {
    admin: { label: 'Admin', color: '#c9a84c', desc: 'Full access to all data and settings' },
    manager: { label: 'Manager', color: '#2563eb', desc: 'Can add and edit projects, resources, suppliers' },
    viewer: { label: 'Viewer', color: '#16a34a', desc: 'Read-only access to all catalogs' },
}

function SectionHeader({ icon: Icon, title, sub }) {
    return (
        <div className="st-section-header">
            <div className="st-section-icon"><Icon size={16} strokeWidth={1.5} /></div>
            <div>
                <div className="st-section-title">{title}</div>
                {sub && <div className="st-section-sub">{sub}</div>}
            </div>
        </div>
    )
}

// ── Profile section ───────────────────────────────────
function ProfileSection() {
    const { profile, loading, saving, error, updateProfile, uploadAvatar } = useProfile()
    const [name, setName] = useState('')
    const [toast, setToast] = useState(null)
    const [initDone, setInitDone] = useState(false)
    const fileRef = useRef()

    // Sync name once profile loads
    if (profile && !initDone) {
        setName(profile.full_name || '')
        setInitDone(true)
    }

    function showToast(msg, type = 'success') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    async function handleSaveName(e) {
        e.preventDefault()
        try {
            await updateProfile({ full_name: name })
            showToast('Profile updated.')
        } catch { showToast('Failed to save.', 'danger') }
    }

    async function handleAvatarChange(e) {
        const file = e.target.files[0]
        if (!file) return
        try {
            await uploadAvatar(file)
            showToast('Avatar updated.')
        } catch { showToast('Avatar upload failed.', 'danger') }
    }

    const initials = (profile?.full_name || '?')
        .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

    const role = ROLES[profile?.role] || ROLES.viewer

    return (
        <div className="st-card">
            <SectionHeader icon={User} title="User profile" sub="Your name and avatar shown across the app" />

            {loading ? (
                <div className="st-skeleton-rows">
                    {[100, 200, 60].map((w, i) => (
                        <div key={i} className="st-skeleton" style={{ width: w, height: 16 }} />
                    ))}
                </div>
            ) : (
                <div className="st-profile-body">
                    {/* Avatar */}
                    <div className="st-avatar-wrap">
                        <div className="st-avatar">
                            {profile?.avatar_url
                                ? <img src={profile.avatar_url} alt={profile.full_name} />
                                : <span>{initials}</span>
                            }
                            <button
                                className="st-avatar-edit"
                                onClick={() => fileRef.current?.click()}
                                disabled={saving}
                                title="Change avatar"
                            >
                                {saving ? <Loader size={13} className="st-spin" /> : <Camera size={13} strokeWidth={1.5} />}
                            </button>
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleAvatarChange}
                        />
                        <div>
                            <div className="st-avatar-name">{profile?.full_name || 'No name set'}</div>
                            <div className="st-avatar-role" style={{ color: role.color }}>
                                <Shield size={12} strokeWidth={1.5} />
                                {role.label}
                            </div>
                        </div>
                    </div>

                    {/* Role badge */}
                    <div className="st-role-info">
                        <div className="st-role-badge" style={{ background: role.color + '18', color: role.color, borderColor: role.color + '30' }}>
                            <Shield size={13} strokeWidth={1.5} />
                            {role.label}
                        </div>
                        <span className="st-role-desc">{role.desc}</span>
                    </div>

                    {/* Name form */}
                    <form onSubmit={handleSaveName} className="st-profile-form">
                        <div className="mf-group">
                            <label>Full name</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Your full name"
                            />
                        </div>
                        <div className="mf-group">
                            <label>Email</label>
                            <input value={profile?.id ? '(from auth)' : ''} disabled style={{ color: '#aaa89f', background: '#f9f8f5' }} />
                            <span style={{ fontSize: 11.5, color: '#aaa89f', marginTop: 3 }}>
                                Email is managed through your auth account and cannot be changed here.
                            </span>
                        </div>
                        {error && <div className="modal-error">{error}</div>}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving ? <><Loader size={13} className="st-spin" /> Saving…</> : <><Check size={13} /> Save profile</>}
                            </button>
                        </div>
                    </form>
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

// ── Categories section ────────────────────────────────
function CategoriesSection() {
    const { categories, resourceCounts, loading, error, createCategory, updateCategory, deleteCategory } = useCategories()
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [toast, setToast] = useState(null)

    function showToast(msg, type = 'success') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    function openAdd() { setEditing(null); setModalOpen(true) }
    function openEdit(c) { setEditing(c); setModalOpen(true) }

    async function handleSave(payload) {
        if (editing) {
            await updateCategory(editing.id, payload)
            showToast('Category updated.')
        } else {
            await createCategory(payload)
            showToast('Category added.')
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return
        setDeleteLoading(true)
        try {
            await deleteCategory(deleteTarget.id)
            showToast('Category deleted.', 'danger')
        } catch (e) {
            showToast(e.message, 'danger')
        }
        setDeleteLoading(false)
        setDeleteTarget(null)
    }

    const capexCats = categories.filter(c => c.type === 'CAPEX')
    const opexCats = categories.filter(c => c.type === 'OPEX')

    return (
        <div className="st-card">
            <div className="st-card-header">
                <SectionHeader
                    icon={Tag}
                    title="Categories"
                    sub="Manage CAPEX and OPEX categories used across resources and projects"
                />
                <button className="btn-primary" onClick={openAdd}>
                    <Plus size={14} strokeWidth={2} /> Add category
                </button>
            </div>

            {error && (
                <div className="rc-error" style={{ marginBottom: 16 }}>
                    <AlertTriangle size={14} /> {error}
                </div>
            )}

            {loading ? (
                <div className="st-skeleton-rows">
                    {[1, 2, 3, 4].map(i => <div key={i} className="st-skeleton" style={{ height: 48 }} />)}
                </div>
            ) : categories.length === 0 ? (
                <div className="rc-empty" style={{ padding: '40px 0' }}>
                    <div className="rc-empty-icon">🏷️</div>
                    <p>No categories yet</p>
                    <span>Add your first category to start tagging resources and projects.</span>
                    <button className="btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>
                        <Plus size={14} /> Add category
                    </button>
                </div>
            ) : (
                <div className="st-categories-body">
                    {/* Summary row */}
                    <div className="st-cat-summary">
                        <div className="st-cat-summary-item">
                            <span className="st-cat-summary-count" style={{ color: '#2563eb' }}>{capexCats.length}</span>
                            <span className="badge badge-blue">CAPEX</span>
                        </div>
                        <div className="st-cat-divider" />
                        <div className="st-cat-summary-item">
                            <span className="st-cat-summary-count" style={{ color: '#8b5cf6' }}>{opexCats.length}</span>
                            <span className="badge badge-purple">OPEX</span>
                        </div>
                        <div className="st-cat-divider" />
                        <div className="st-cat-summary-item">
                            <span className="st-cat-summary-count" style={{ color: '#1a1917' }}>{categories.length}</span>
                            <span style={{ fontSize: 12, color: '#9a9790' }}>total</span>
                        </div>
                    </div>

                    {/* Category list */}
                    {[
                        { label: 'CAPEX', items: capexCats, badgeClass: 'badge-blue' },
                        { label: 'OPEX', items: opexCats, badgeClass: 'badge-purple' },
                    ].map(({ label, items, badgeClass }) => items.length > 0 && (
                        <div key={label} className="st-cat-group">
                            <div className="st-cat-group-label">
                                <span className={`badge ${badgeClass}`}>{label}</span>
                                <span className="st-cat-group-count">{items.length} {items.length === 1 ? 'category' : 'categories'}</span>
                            </div>
                            <div className="st-cat-list">
                                {items.map((cat, i) => {
                                    const count = resourceCounts[cat.id] || 0
                                    return (
                                        <div
                                            key={cat.id}
                                            className="st-cat-row"
                                            style={{ animationDelay: `${i * 30}ms` }}
                                        >
                                            <div className="st-cat-icon">
                                                <Tag size={14} strokeWidth={1.5} />
                                            </div>
                                            <div className="st-cat-info">
                                                <div className="st-cat-name">{cat.name}</div>
                                                {cat.description && (
                                                    <div className="st-cat-desc">{cat.description}</div>
                                                )}
                                            </div>
                                            <div className="st-cat-resource-count" title={`${count} resource${count !== 1 ? 's' : ''} using this category`}>
                                                {count > 0 && (
                                                    <>
                                                        <span className="st-cat-count-num">{count}</span>
                                                        <span className="st-cat-count-label">resource{count !== 1 ? 's' : ''}</span>
                                                    </>
                                                )}
                                            </div>
                                            <div className="st-cat-actions">
                                                <button className="rc-btn" onClick={() => openEdit(cat)} title="Edit">
                                                    <Pencil size={13} strokeWidth={1.5} />
                                                </button>
                                                <button
                                                    className="rc-btn rc-btn-danger"
                                                    onClick={() => setDeleteTarget({ ...cat, resourceCount: count })}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={13} strokeWidth={1.5} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Category modal */}
            <CategoryModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                category={editing}
            />

            {/* Delete confirm */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
                    <div className="modal-box" style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h3>Delete category?</h3>
                            <button className="modal-close" onClick={() => setDeleteTarget(null)}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '12px 0 20px' }}>
                            <p style={{ fontSize: 14, color: '#4a4844', lineHeight: 1.6, marginBottom: 12 }}>
                                You're about to delete <strong style={{ color: '#1a1917' }}>{deleteTarget.name}</strong>.
                            </p>
                            {deleteTarget.resourceCount > 0 ? (
                                <div className="st-delete-warning">
                                    <AlertTriangle size={15} strokeWidth={1.5} />
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 3 }}>
                                            {deleteTarget.resourceCount} resource{deleteTarget.resourceCount !== 1 ? 's' : ''} will be affected
                                        </div>
                                        <div style={{ fontSize: 12.5 }}>
                                            These resources will lose their category assignment. They won't be deleted, but will appear as uncategorized.
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p style={{ fontSize: 13, color: '#9a9790' }}>
                                    This category has no resources linked to it. Safe to delete.
                                </p>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
                            <button className="btn-danger" onClick={handleDelete} disabled={deleteLoading}>
                                {deleteLoading ? 'Deleting…' : 'Delete category'}
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

// ── Main ──────────────────────────────────────────────
export default function Settings() {
    return (
        <div className="st-page">
            <div className="page-header">
                <div className="page-header-text">
                    <h2>Settings</h2>
                    <p>Manage your profile and app configuration.</p>
                </div>
            </div>

            <div className="st-layout">
                <ProfileSection />
                <CategoriesSection />
            </div>
        </div>
    )
}