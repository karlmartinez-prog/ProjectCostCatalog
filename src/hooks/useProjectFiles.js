import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const BUCKET = 'project-files'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

// ── File type detection ───────────────────────────────
export function getFileType(mimeType) {
    if (mimeType?.startsWith('image/')) return 'image'
    if (mimeType === 'application/pdf') return 'document'
    if (mimeType?.includes('word')) return 'document'
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return 'document'
    if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return 'document'
    return 'other'
}

export function formatFileSize(bytes) {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Storage path builder ──────────────────────────────
function buildStoragePath(projectId, folderId, filename) {
    const ts = Date.now()
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const folder = folderId || 'uncategorized'
    return `${projectId}/${folder}/${ts}-${safe}`
}

// ── Main hook ─────────────────────────────────────────
export function useProjectFiles(projectId) {
    const [folders, setFolders] = useState([])
    const [files, setFiles] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [canWrite, setCanWrite] = useState(false)

    // ── Auth / RBAC check ─────────────────────────────
    useEffect(() => {
        async function checkRole() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()
            setCanWrite(profile?.role === 'admin' || profile?.role === 'manager')
        }
        checkRole()
    }, [])

    // ── Fetch folders + files ─────────────────────────
    const refetch = useCallback(async () => {
        if (!projectId) return
        setLoading(true)
        setError(null)
        const [{ data: foldersData, error: e1 }, { data: filesData, error: e2 }] = await Promise.all([
            supabase
                .from('project_folders')
                .select('*')
                .eq('project_id', projectId)
                .order('sort_order')
                .order('created_at'),
            supabase
                .from('project_files')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at'),
        ])
        if (e1 || e2) { setError((e1 || e2).message); setLoading(false); return }
        setFolders(foldersData || [])
        setFiles(filesData || [])
        setLoading(false)
    }, [projectId])

    useEffect(() => { refetch() }, [refetch])

    // ── Folder CRUD ───────────────────────────────────
    async function createFolder(name) {
        const maxOrder = folders.length ? Math.max(...folders.map(f => f.sort_order)) : -1
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error } = await supabase
            .from('project_folders')
            .insert([{ project_id: projectId, name: name.trim(), sort_order: maxOrder + 1, created_by: user?.id }])
            .select('*')
            .maybeSingle()
        if (error) throw error
        setFolders(prev => [...prev, data])
        return data
    }

    async function renameFolder(id, name) {
        const { data, error } = await supabase
            .from('project_folders')
            .update({ name: name.trim() })
            .eq('id', id)
            .select('*')
            .maybeSingle()
        if (error) throw error
        setFolders(prev => prev.map(f => f.id === id ? data : f))
    }

    async function deleteFolder(id) {
        // Move files in this folder to uncategorized (folder_id = null)
        await supabase.from('project_files').update({ folder_id: null }).eq('folder_id', id)
        const { error } = await supabase.from('project_folders').delete().eq('id', id)
        if (error) throw error
        setFolders(prev => prev.filter(f => f.id !== id))
        setFiles(prev => prev.map(f => f.folder_id === id ? { ...f, folder_id: null } : f))
    }

    // ── File upload ───────────────────────────────────
    // Returns { success, error } per file. onProgress(filename, pct) optional callback.
    async function uploadFiles(fileList, folderId, onProgress) {
        const { data: { user } } = await supabase.auth.getUser()
        const results = []

        for (const file of Array.from(fileList)) {
            if (file.size > MAX_FILE_SIZE) {
                results.push({ name: file.name, error: 'File exceeds 50 MB limit.' })
                continue
            }

            const storagePath = buildStoragePath(projectId, folderId, file.name)
            onProgress?.(file.name, 10)

            const { error: upErr } = await supabase.storage
                .from(BUCKET)
                .upload(storagePath, file, { upsert: false })

            if (upErr) { results.push({ name: file.name, error: upErr.message }); continue }
            onProgress?.(file.name, 70)

            const mimeType = file.type || null
            const fileType = getFileType(mimeType)

            const { data: meta, error: metaErr } = await supabase
                .from('project_files')
                .insert([{
                    project_id: projectId,
                    folder_id: folderId || null,
                    name: file.name,
                    storage_path: storagePath,
                    file_type: fileType,
                    mime_type: mimeType,
                    file_size: file.size,
                    uploaded_by: user?.id,
                }])
                .select('*')
                .maybeSingle()

            if (metaErr) {
                // Clean up orphaned storage file
                await supabase.storage.from(BUCKET).remove([storagePath])
                results.push({ name: file.name, error: metaErr.message })
                continue
            }

            setFiles(prev => [...prev, meta])
            onProgress?.(file.name, 100)
            results.push({ name: file.name, success: true, data: meta })
        }

        return results
    }

    // ── File operations ───────────────────────────────
    async function renameFile(id, name) {
        const { data, error } = await supabase
            .from('project_files')
            .update({ name: name.trim() })
            .eq('id', id)
            .select('*')
            .maybeSingle()
        if (error) throw error
        setFiles(prev => prev.map(f => f.id === id ? data : f))
    }

    async function moveFile(id, folderId) {
        const { data, error } = await supabase
            .from('project_files')
            .update({ folder_id: folderId || null })
            .eq('id', id)
            .select('*')
            .maybeSingle()
        if (error) throw error
        setFiles(prev => prev.map(f => f.id === id ? data : f))
    }

    async function deleteFile(id) {
        const file = files.find(f => f.id === id)
        if (!file) return

        // Remove from storage first
        await supabase.storage.from(BUCKET).remove([file.storage_path])

        const { error } = await supabase.from('project_files').delete().eq('id', id)
        if (error) throw error
        setFiles(prev => prev.filter(f => f.id !== id))
    }

    // ── Signed URL (60 min expiry) ────────────────────
    async function getSignedUrl(storagePath, expiresIn = 3600) {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(storagePath, expiresIn)
        if (error) throw error
        return data.signedUrl
    }

    return {
        folders, files, loading, error, canWrite,
        createFolder, renameFolder, deleteFolder,
        uploadFiles, renameFile, moveFile, deleteFile,
        getSignedUrl, refetch,
    }
}