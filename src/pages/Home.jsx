// Home.jsx
export default function Home() {
    return (
        <div>
            <div className="page-header">
                <div className="page-header-text">
                    <h2>Dashboard</h2>
                    <p>Overview of your cost catalog and projects.</p>
                </div>
            </div>
            <div className="stat-grid">
                {['Total Projects', 'Total Resources', 'Suppliers', 'CAPEX This Year', 'OPEX This Year'].map(label => (
                    <div className="stat-card" key={label}>
                        <div className="stat-card-label">{label}</div>
                        <div className="stat-card-value">—</div>
                        <div className="stat-card-sub">Coming soon</div>
                    </div>
                ))}
            </div>
            <div className="card">
                <p style={{ color: '#aaa89f', fontSize: 14 }}>Recent activity will appear here.</p>
            </div>
        </div>
    )
}