import { useState, useRef, useCallback } from 'react'
import {
    FolderPlus, Upload, Folder, FolderOpen, File, FileText,
    Image, Sheet, MoreVertical, Pencil, Trash2, FolderInput,
    Download, X, Check, Loader, AlertTriangle, Plus
} from 'lucide-react'
import { useProjectFiles, formatFileSize } from '../../hooks/useProjectFiles'
import FileLightbox from './FileLightbox'

// ── File type icon ─────────────────────────────────────
function FileIcon({ file, size = 28 }) {
    if (file.file_type === 'image' && file.signedUrl) {
        return (
            <img
                src={file.signedUrl}
                alt={file.name}
                style={{ width: size, height: size, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
            />
        )
    }
    const style = { flexShrink: 0 }
    if (file.mime_type === 'application/pdf') return <FileText size={size * 0.7} style={{ ...style, color: '#dc2626' }} />
    if (file.mime_type?.includes('word')) return <FileText size={size * 0.7} style={{ ...style, color: '#2563eb' }} />
    if (file.mime_type?.includes('spreadsheet') || file.mime_type?.includes('excel'))
        return <Sheet size={size * 0.7} style={{ ...style, color: '#16a34a' }} />
    if (file.file_type === 'image') return <Image size={size * 0.7} style={{ ...style, color: '#8b5cf6' }} />
    return <File size={size * 0.7} style={{ ...style, color: '#aaa89f' }} />
}

// ── Per-file action menu ───────────────────────────────
function FileMenu({ file, folders, canWrite, onRename, onMove, onDelete, onDownload }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useCallback(() => {
        function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={e => { e.stopPropagation(); setOpen(s => !s) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 5, color: '#aaa89f', display: 'flex', alignItems: 'center' }}
                title="More actions"
            >
                <MoreVertical size={15} strokeWidth={1.5} />
            </button>
            {open && (
                <div style={{
                    position: 'absolute', right: 0, top: '100%', zIndex: 50,
                    background: '#fff', border: '1px solid #e8e5de', borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: 160, overflow: 'hidden',
                }}>
                    <MenuItem icon={<Download size={13} />} label="Download" onClick={() => { onDownload(file); setOpen(false) }} />
                    {canWrite && <>
                        <MenuItem icon={<Pencil size={13} />} label="Rename" onClick={() => { onRename(file); setOpen(false) }} />
                        {folders.length > 0 && (
                            <MenuItem icon={<FolderInput size={13} />} label="Move to folder" onClick={() => { onMove(file); setOpen(false) }} />
                        )}
                        <div style={{ height: 1, background: '#f0ede8', margin: '2px 0' }} />
                        <MenuItem icon={<Trash2 size={13} />} label="Delete" onClick={() => { onDelete(file); setOpen(false) }} danger />
                    </>}
                </div>
            )}
        </div>
    )
}

function MenuItem({ icon, label, onClick, danger }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 12px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12.5, color: danger ? '#dc2626' : '#1a1917', textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = danger ? '#fef2f2' : '#faf8f5'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
            <span style={{ color: danger ? '#dc2626' : '#aaa89f' }}>{icon}</span>
            {label}
        </button>
    )
}

// ── Upload drop zone ───────────────────────────────────
function UploadZone({ onFiles, uploading, dragActive, setDragActive }) {
    const inputRef = useRef(null)

    function handleDrop(e) {
        e.preventDefault()
        setDragActive(false)
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
    }

    return (
        <div
            onDragOver={e => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
                border: `2px dashed ${dragActive ? '#c9a84c' : '#e8e5de'}`,
                borderRadius: 10, padding: '28px 20px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
                background: dragActive ? '#fdf9f0' : '#faf8f5',
                marginBottom: 16,
            }}
        >
            <input ref={inputRef} type="file" multiple style={{ display: 'none' }}
                onChange={e => onFiles(e.target.files)} />
            {uploading
                ? <Loader size={22} strokeWidth={1.5} style={{ color: '#c9a84c', margin: '0 auto 8px', display: 'block' }} className="ins-spin" />
                : <Upload size={22} strokeWidth={1.5} style={{ color: '#c9a84c', margin: '0 auto 8px', display: 'block' }} />
            }
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1917', marginBottom: 3 }}>
                {uploading ? 'Uploading…' : dragActive ? 'Drop files here' : 'Drop files or click to browse'}
            </div>
            <div style={{ fontSize: 11.5, color: '#aaa89f' }}>Max 50 MB per file</div>
        </div>
    )
}

// ── Inline rename input ────────────────────────────────
function InlineRename({ value, onSave, onCancel }) {
    const [val, setVal] = useState(value)
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <input
                autoFocus
                value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onSave(val); if (e.key === 'Escape') onCancel() }}
                style={{ flex: 1, padding: '3px 8px', border: '1px solid #c9a84c', borderRadius: 5, fontSize: 13 }}
                onClick={e => e.stopPropagation()}
            />
            <button onClick={() => onSave(val)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 2 }}><Check size={14} /></button>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa89f', padding: 2 }}><X size={14} /></button>
        </div>
    )
}

// ── Main component ─────────────────────────────────────
export default function ProjectFilesTab({ project }) {
    const {
        folders, files, loading, error, canWrite,
        createFolder, renameFolder, deleteFolder,
        uploadFiles, renameFile, moveFile, deleteFile,
        getSignedUrl,
    } = useProjectFiles(project?.id)

    // UI state
    const [expandedFolders, setExpandedFolders] = useState(new Set(['__uncategorized__']))
    const [renamingFolder, setRenamingFolder] = useState(null)  // folder id
    const [renamingFile, setRenamingFile] = useState(null)  // file id
    const [deletingFolder, setDeletingFolder] = useState(null)
    const [deletingFile, setDeletingFile] = useState(null)
    const [movingFile, setMovingFile] = useState(null)
    const [uploadFolder, setUploadFolder] = useState(null)  // folder context for upload
    const [dragActive, setDragActive] = useState(false)
    const [uploadProgress, setUploadProgress] = useState({})    // { filename: pct }
    const [uploading, setUploading] = useState(false)
    const [addingFolder, setAddingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [toast, setToast] = useState(null)

    // Lightbox state
    const [lightboxImages, setLightboxImages] = useState([])  // files with signedUrl
    const [lightboxIndex, setLightboxIndex] = useState(0)

    // Signed URL cache
    const [urlCache, setUrlCache] = useState({})  // { storagePath: signedUrl }

    function showToast(msg, type = 'success') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    function toggleFolder(id) {
        setExpandedFolders(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    // ── Signed URL resolution ─────────────────────────
    async function resolveUrl(file) {
        if (urlCache[file.storage_path]) return urlCache[file.storage_path]
        const url = await getSignedUrl(file.storage_path)
        setUrlCache(prev => ({ ...prev, [file.storage_path]: url }))
        return url
    }

    // ── Upload handler ────────────────────────────────
    async function handleUpload(fileList, folderId) {
        setUploading(true)
        const results = await uploadFiles(fileList, folderId, (name, pct) => {
            setUploadProgress(prev => ({ ...prev, [name]: pct }))
        })
        setUploading(false)
        setUploadProgress({})

        const errors = results.filter(r => r.error)
        const ok = results.filter(r => r.success)
        if (ok.length) showToast(`${ok.length} file${ok.length > 1 ? 's' : ''} uploaded.`)
        if (errors.length) showToast(`${errors.length} file(s) failed: ${errors.map(e => e.name).join(', ')}`, 'danger')
    }

    // ── Open lightbox ─────────────────────────────────
    async function openLightbox(imageFiles, clickedFile) {
        // Resolve signed URLs for all images in this folder group
        const withUrls = await Promise.all(
            imageFiles.map(async f => ({ ...f, signedUrl: await resolveUrl(f) }))
        )
        const idx = withUrls.findIndex(f => f.id === clickedFile.id)
        setLightboxImages(withUrls)
        setLightboxIndex(idx >= 0 ? idx : 0)
    }

    // ── Download ──────────────────────────────────────
    async function handleDownload(file) {
        try {
            const url = await resolveUrl(file)
            const a = document.createElement('a')
            a.href = url
            a.download = file.name
            a.target = '_blank'
            a.click()
        } catch (e) { showToast('Download failed: ' + e.message, 'danger') }
    }

    // ── Open PDF in new tab ───────────────────────────
    async function handleOpenPdf(file) {
        try {
            const url = await resolveUrl(file)
            window.open(url, '_blank')
        } catch (e) { showToast('Could not open file: ' + e.message, 'danger') }
    }

    // ── File click handler ────────────────────────────
    function handleFileClick(file, folderFiles) {
        if (file.file_type === 'image') {
            const imageFiles = folderFiles.filter(f => f.file_type === 'image')
            openLightbox(imageFiles, file)
        } else if (file.mime_type === 'application/pdf') {
            handleOpenPdf(file)
        } else {
            handleDownload(file)
        }
    }

    // ── Build folder sections ─────────────────────────
    // Each section: { id, name, files[] }
    const folderSections = [
        ...folders.map(f => ({
            id: f.id,
            name: f.name,
            isReal: true,
            folder: f,
            files: files.filter(fi => fi.folder_id === f.id),
        })),
        {
            id: '__uncategorized__',
            name: 'Uncategorized',
            isReal: false,
            files: files.filter(fi => !fi.folder_id),
        },
    ].filter(s => s.files.length > 0 || s.isReal) // hide empty uncategorized

    const totalFiles = files.length

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

    return (
        <div>
            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 16px', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {canWrite && (
                        <>
                            <button
                                className="btn-ghost"
                                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                                onClick={() => setAddingFolder(true)}
                            >
                                <FolderPlus size={14} strokeWidth={1.5} /> New folder
                            </button>
                            <button
                                className="btn-primary"
                                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                                onClick={() => { setUploadFolder(null); document.getElementById('pf-upload-input').click() }}
                            >
                                <Upload size={13} strokeWidth={1.5} /> Upload files
                            </button>
                            <input id="pf-upload-input" type="file" multiple style={{ display: 'none' }}
                                onChange={e => handleUpload(e.target.files, uploadFolder)} />
                        </>
                    )}
                </div>
                <div style={{ fontSize: 12, color: '#aaa89f' }}>
                    {totalFiles} file{totalFiles !== 1 ? 's' : ''}
                </div>
            </div>

            {/* ── New folder input ── */}
            {addingFolder && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 12px', background: '#faf8f5', borderRadius: 8, border: '1px solid #e8e5de' }}>
                    <Folder size={15} strokeWidth={1.5} style={{ color: '#c9a84c' }} />
                    <input
                        autoFocus
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        onKeyDown={async e => {
                            if (e.key === 'Enter' && newFolderName.trim()) {
                                await createFolder(newFolderName)
                                setNewFolderName('')
                                setAddingFolder(false)
                                showToast('Folder created.')
                            }
                            if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName('') }
                        }}
                        placeholder="Folder name…"
                        style={{ flex: 1, border: '1px solid #c9a84c', borderRadius: 5, padding: '4px 8px', fontSize: 13 }}
                    />
                    <button className="btn-primary" style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={async () => {
                            if (!newFolderName.trim()) return
                            await createFolder(newFolderName)
                            setNewFolderName('')
                            setAddingFolder(false)
                            showToast('Folder created.')
                        }}>
                        <Check size={13} /> Create
                    </button>
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => { setAddingFolder(false); setNewFolderName('') }}>
                        <X size={13} /> Cancel
                    </button>
                </div>
            )}

            {/* ── Drop zone (shown when no files yet or canWrite) ── */}
            {canWrite && totalFiles === 0 && (
                <UploadZone
                    onFiles={f => handleUpload(f, null)}
                    uploading={uploading}
                    dragActive={dragActive}
                    setDragActive={setDragActive}
                />
            )}

            {/* ── Upload progress ── */}
            {Object.keys(uploadProgress).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                    {Object.entries(uploadProgress).map(([name, pct]) => (
                        <div key={name} style={{ marginBottom: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#7a7872', marginBottom: 3 }}>
                                <span>{name}</span><span>{pct}%</span>
                            </div>
                            <div style={{ height: 4, background: '#f0ede8', borderRadius: 99 }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: '#c9a84c', borderRadius: 99, transition: 'width 0.2s' }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Empty state ── */}
            {totalFiles === 0 && !canWrite && (
                <div style={{ textAlign: 'center', padding: '48px 24px', background: '#faf8f5', borderRadius: 12, border: '1px dashed #e8e5de' }}>
                    <File size={32} strokeWidth={1} style={{ color: '#c9a84c', marginBottom: 12 }} />
                    <div style={{ fontWeight: 600, color: '#1a1917', marginBottom: 4 }}>No files yet</div>
                    <div style={{ fontSize: 13, color: '#aaa89f' }}>No files have been uploaded to this project.</div>
                </div>
            )}

            {/* ── Folder sections ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {folderSections.map(section => {
                    const isExpanded = expandedFolders.has(section.id)
                    const imageFiles = section.files.filter(f => f.file_type === 'image')

                    return (
                        <div key={section.id} style={{ border: '1px solid #e8e5de', borderRadius: 10, overflow: 'hidden' }}>
                            {/* Folder header */}
                            <div
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '10px 14px', background: '#faf8f5',
                                    cursor: 'pointer', userSelect: 'none',
                                    borderBottom: isExpanded ? '1px solid #e8e5de' : 'none',
                                }}
                                onClick={() => toggleFolder(section.id)}
                            >
                                {isExpanded
                                    ? <FolderOpen size={16} strokeWidth={1.5} style={{ color: '#c9a84c', flexShrink: 0 }} />
                                    : <Folder size={16} strokeWidth={1.5} style={{ color: '#c9a84c', flexShrink: 0 }} />
                                }

                                {renamingFolder === section.id && section.isReal ? (
                                    <InlineRename
                                        value={section.name}
                                        onSave={async v => { await renameFolder(section.id, v); setRenamingFolder(null); showToast('Folder renamed.') }}
                                        onCancel={() => setRenamingFolder(null)}
                                    />
                                ) : (
                                    <span style={{ fontWeight: 600, fontSize: 13, color: '#1a1917', flex: 1 }}>
                                        {section.name}
                                    </span>
                                )}

                                <span style={{ fontSize: 11, color: '#aaa89f', marginLeft: 'auto' }}>
                                    {section.files.length} file{section.files.length !== 1 ? 's' : ''}
                                </span>

                                {/* Folder actions */}
                                {canWrite && section.isReal && (
                                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                                        <button
                                            title="Upload to this folder"
                                            onClick={() => { setUploadFolder(section.id); document.getElementById('pf-upload-input').click() }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#aaa89f', display: 'flex' }}
                                        >
                                            <Upload size={13} strokeWidth={1.5} />
                                        </button>
                                        <button
                                            title="Rename folder"
                                            onClick={() => setRenamingFolder(section.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#aaa89f', display: 'flex' }}
                                        >
                                            <Pencil size={13} strokeWidth={1.5} />
                                        </button>
                                        <button
                                            title="Delete folder"
                                            onClick={() => setDeletingFolder(section.folder)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#dc2626', display: 'flex' }}
                                        >
                                            <Trash2 size={13} strokeWidth={1.5} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Files list */}
                            {isExpanded && (
                                <div>
                                    {section.files.length === 0 ? (
                                        <div style={{ padding: '20px 14px', fontSize: 12.5, color: '#aaa89f', textAlign: 'center' }}>
                                            Empty folder
                                            {canWrite && (
                                                <button
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c9a84c', fontSize: 12.5, marginLeft: 8 }}
                                                    onClick={() => { setUploadFolder(section.id); document.getElementById('pf-upload-input').click() }}
                                                >
                                                    Upload files →
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        section.files.map((file, idx) => (
                                            <div
                                                key={file.id}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                    padding: '9px 14px',
                                                    borderBottom: idx < section.files.length - 1 ? '1px solid #f5f3ef' : 'none',
                                                    cursor: file.file_type === 'image' || file.mime_type === 'application/pdf' ? 'pointer' : 'default',
                                                    transition: 'background 0.1s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#faf8f5'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                onClick={() => handleFileClick(file, section.files)}
                                            >
                                                {/* Icon / thumbnail */}
                                                <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <FileIcon file={file} size={32} />
                                                </div>

                                                {/* Name */}
                                                {renamingFile === file.id ? (
                                                    <InlineRename
                                                        value={file.name}
                                                        onSave={async v => { await renameFile(file.id, v); setRenamingFile(null); showToast('File renamed.') }}
                                                        onCancel={() => setRenamingFile(null)}
                                                    />
                                                ) : (
                                                    <span style={{ flex: 1, fontSize: 13, color: '#1a1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {file.name}
                                                    </span>
                                                )}

                                                {/* Size */}
                                                <span style={{ fontSize: 11.5, color: '#aaa89f', flexShrink: 0 }}>
                                                    {formatFileSize(file.file_size)}
                                                </span>

                                                {/* Actions menu */}
                                                <FileMenu
                                                    file={file}
                                                    folders={folders}
                                                    canWrite={canWrite}
                                                    onRename={() => setRenamingFile(file.id)}
                                                    onMove={() => setMovingFile(file)}
                                                    onDelete={() => setDeletingFile(file)}
                                                    onDownload={handleDownload}
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* ── Move file modal ── */}
            {movingFile && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMovingFile(null)}>
                    <div className="modal-box" style={{ maxWidth: 380 }}>
                        <div className="modal-header">
                            <h3>Move "{movingFile.name}"</h3>
                            <button className="modal-close" onClick={() => setMovingFile(null)}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '12px 0 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid #e8e5de', borderRadius: 7, background: '#faf8f5', cursor: 'pointer', fontSize: 13 }}
                                onClick={async () => { await moveFile(movingFile.id, null); setMovingFile(null); showToast('File moved.') }}
                            >
                                <Folder size={14} style={{ color: '#aaa89f' }} /> Uncategorized
                            </button>
                            {folders.map(f => (
                                <button
                                    key={f.id}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid #e8e5de', borderRadius: 7, background: '#faf8f5', cursor: 'pointer', fontSize: 13 }}
                                    onClick={async () => { await moveFile(movingFile.id, f.id); setMovingFile(null); showToast('File moved.') }}
                                >
                                    <Folder size={14} style={{ color: '#c9a84c' }} /> {f.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete file confirm ── */}
            {deletingFile && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeletingFile(null)}>
                    <div className="modal-box" style={{ maxWidth: 380 }}>
                        <div className="modal-header">
                            <h3>Delete file?</h3>
                            <button className="modal-close" onClick={() => setDeletingFile(null)}><X size={18} /></button>
                        </div>
                        <p style={{ fontSize: 14, color: '#4a4844', padding: '12px 0 20px', lineHeight: 1.6 }}>
                            <strong>{deletingFile.name}</strong> will be permanently deleted from storage.
                        </p>
                        <div className="modal-actions">
                            <button className="btn-ghost" onClick={() => setDeletingFile(null)}>Cancel</button>
                            <button className="btn-danger" onClick={async () => {
                                await deleteFile(deletingFile.id)
                                setDeletingFile(null)
                                showToast('File deleted.', 'danger')
                            }}>Delete file</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete folder confirm ── */}
            {deletingFolder && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeletingFolder(null)}>
                    <div className="modal-box" style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3>Delete folder?</h3>
                            <button className="modal-close" onClick={() => setDeletingFolder(null)}><X size={18} /></button>
                        </div>
                        <p style={{ fontSize: 14, color: '#4a4844', padding: '12px 0 4px', lineHeight: 1.6 }}>
                            Delete <strong>{deletingFolder.name}</strong>?
                        </p>
                        <p style={{ fontSize: 13, color: '#aaa89f', paddingBottom: 16 }}>
                            Files inside will be moved to Uncategorized, not deleted.
                        </p>
                        <div className="modal-actions">
                            <button className="btn-ghost" onClick={() => setDeletingFolder(null)}>Cancel</button>
                            <button className="btn-danger" onClick={async () => {
                                await deleteFolder(deletingFolder.id)
                                setDeletingFolder(null)
                                showToast('Folder deleted.')
                            }}>Delete folder</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Image lightbox ── */}
            {lightboxImages.length > 0 && (
                <FileLightbox
                    images={lightboxImages}
                    currentIndex={lightboxIndex}
                    onClose={() => setLightboxImages([])}
                    onNav={setLightboxIndex}
                    onDownload={handleDownload}
                />
            )}

            {toast && (
                <div className={`toast ${toast.type === 'danger' ? 'toast-danger' : 'toast-success'}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    )
}