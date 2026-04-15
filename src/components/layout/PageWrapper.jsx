import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import './layout.css'

export default function PageWrapper({ session }) {
    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-area">
                <Navbar session={session} />
                <main className="page-content">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}