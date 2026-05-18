import { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react'

export default function FileLightbox({ images, currentIndex, onClose, onNav, onDownload }) {
    const image = images[currentIndex]
    const hasPrev = currentIndex > 0
    const hasNext = currentIndex < images.length - 1

    const handleKey = useCallback((e) => {
        if (e.key === 'Escape') onClose()
        if (e.key === 'ArrowLeft' && hasPrev) onNav(currentIndex - 1)
        if (e.key === 'ArrowRight' && hasNext) onNav(currentIndex + 1)
    }, [currentIndex, hasPrev, hasNext, onClose, onNav])

    useEffect(() => {
        document.addEventListener('keydown', handleKey)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', handleKey)
            document.body.style.overflow = ''
        }
    }, [handleKey])

    if (!image) return null

    return (
        <div
            onClick={e => e.target === e.currentTarget && onClose()}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(10, 10, 10, 0.92)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            {/* Close */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute', top: 16, right: 16,
                    background: 'rgba(255,255,255,0.1)', border: 'none',
                    borderRadius: 8, padding: 8, cursor: 'pointer', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(4px)',
                }}
            >
                <X size={20} strokeWidth={1.5} />
            </button>

            {/* Download */}
            <button
                onClick={() => onDownload(image)}
                style={{
                    position: 'absolute', top: 16, right: 60,
                    background: 'rgba(255,255,255,0.1)', border: 'none',
                    borderRadius: 8, padding: 8, cursor: 'pointer', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(4px)',
                }}
                title="Download"
            >
                <Download size={18} strokeWidth={1.5} />
            </button>

            {/* Prev */}
            {hasPrev && (
                <button
                    onClick={() => onNav(currentIndex - 1)}
                    style={{
                        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                        background: 'rgba(255,255,255,0.1)', border: 'none',
                        borderRadius: 8, padding: '10px 8px', cursor: 'pointer', color: '#fff',
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    <ChevronLeft size={24} strokeWidth={1.5} />
                </button>
            )}

            {/* Next */}
            {hasNext && (
                <button
                    onClick={() => onNav(currentIndex + 1)}
                    style={{
                        position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                        background: 'rgba(255,255,255,0.1)', border: 'none',
                        borderRadius: 8, padding: '10px 8px', cursor: 'pointer', color: '#fff',
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    <ChevronRight size={24} strokeWidth={1.5} />
                </button>
            )}

            {/* Image */}
            <div style={{ maxWidth: 'calc(100vw - 120px)', maxHeight: 'calc(100vh - 100px)', position: 'relative' }}>
                <img
                    src={image.signedUrl}
                    alt={image.name}
                    style={{
                        maxWidth: '100%', maxHeight: 'calc(100vh - 100px)',
                        borderRadius: 8, objectFit: 'contain',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                    }}
                />
            </div>

            {/* Caption */}
            <div style={{
                position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '6px 14px',
                backdropFilter: 'blur(4px)', textAlign: 'center',
            }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{image.name}</div>
                {images.length > 1 && (
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
                        {currentIndex + 1} of {images.length}
                    </div>
                )}
            </div>
        </div>
    )
}