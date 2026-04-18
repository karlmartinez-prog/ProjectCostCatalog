import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
    LayoutDashboard,
    FolderKanban,
    Package,
    Truck,
    BarChart3,
    Settings,
    LogOut,
    Boxes
} from 'lucide-react'

const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/projects', label: 'Project Catalog', icon: FolderKanban },
    { to: '/resources', label: 'Resource Catalog', icon: Package },
    { to: '/suppliers', label: 'Suppliers', icon: Truck },
    { to: '/insights', label: 'Insights', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
    const navigate = useNavigate()

    async function handleLogout() {
        await supabase.auth.signOut()
        navigate('/login')
    }

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <Boxes size={22} strokeWidth={1.5} />
                <span>CostCatalog</span>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                            `sidebar-link ${isActive ? 'active' : ''}`
                        }
                    >
                        <Icon size={18} strokeWidth={1.5} />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>

            <button className="sidebar-logout" onClick={handleLogout}>
                <LogOut size={16} strokeWidth={1.5} />
                <span>Sign out</span>
            </button>
        </aside>
    )
}