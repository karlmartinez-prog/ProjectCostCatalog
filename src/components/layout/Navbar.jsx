import { useLocation } from 'react-router-dom'
import { Bell, Search } from 'lucide-react'

const PAGE_TITLES = {
    '/': 'Dashboard',
    '/projects': 'Project Catalog',
    '/resources': 'Resource Catalog',
    '/suppliers': 'Suppliers',
    '/insights': 'Business Insights',
}

export default function Navbar({ session }) {
    const { pathname } = useLocation()
    const title = PAGE_TITLES[pathname] ?? 'CostCatalog'
    const name = session?.user?.user_metadata?.full_name ?? session?.user?.email ?? 'User'
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

    return (
        <header className="navbar">
            <div className="navbar-left">
                <h1 className="navbar-title">{title}</h1>
            </div>
            <div className="navbar-right">
                <div className="navbar-search">
                    <Search size={15} strokeWidth={1.5} />
                    <input placeholder="Search anything…" />
                </div>
                <button className="navbar-icon-btn">
                    <Bell size={18} strokeWidth={1.5} />
                </button>
                <div className="navbar-avatar" title={name}>
                    {initials}
                </div>
            </div>
        </header>
    )
}