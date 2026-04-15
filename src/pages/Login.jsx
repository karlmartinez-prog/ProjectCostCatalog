import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Boxes, Eye, EyeOff } from 'lucide-react'

const ROLES = ['admin', 'manager', 'viewer']

export default function Login() {
    const [mode, setMode] = useState('login')  // 'login' | 'signup'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [role, setRole] = useState('viewer')
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    async function handleSubmit(e) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        if (mode === 'login') {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) setError(error.message)
        } else {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName, role }
                }
            })
            if (error) setError(error.message)
            else setSuccess('Account created! Check your email to confirm.')
        }
        setLoading(false)
    }

    return (
        <div className="login-page">
            <div className="login-left">
                <div className="login-brand">
                    <Boxes size={28} strokeWidth={1.5} />
                    <span>CostCatalog</span>
                </div>
                <div className="login-tagline">
                    <h2>Track every peso.<br />Plan every project.</h2>
                    <p>Historical costs, inflation engine, and AI-powered estimates — all in one place.</p>
                </div>
                <div className="login-dots">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="login-dot" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                </div>
            </div>

            <div className="login-right">
                <div className="login-box">
                    <div className="login-tabs">
                        <button
                            className={`login-tab ${mode === 'login' ? 'active' : ''}`}
                            onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
                        >Sign in</button>
                        <button
                            className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
                            onClick={() => { setMode('signup'); setError(null); setSuccess(null) }}
                        >Create account</button>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        {mode === 'signup' && (
                            <div className="form-group">
                                <label>Full name</label>
                                <input
                                    type="text"
                                    placeholder="Juan dela Cruz"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <div className="input-icon-wrap">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                />
                                <button type="button" className="input-icon-btn" onClick={() => setShowPass(s => !s)}>
                                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {mode === 'signup' && (
                            <div className="form-group">
                                <label>Role</label>
                                <div className="role-picker">
                                    {ROLES.map(r => (
                                        <button
                                            key={r}
                                            type="button"
                                            className={`role-btn ${role === r ? 'active' : ''}`}
                                            onClick={() => setRole(r)}
                                        >
                                            {r.charAt(0).toUpperCase() + r.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                <p className="role-hint">
                                    {role === 'admin' && 'Full access — manage all data and users.'}
                                    {role === 'manager' && 'Can add and edit projects, resources, suppliers.'}
                                    {role === 'viewer' && 'Read-only access to all catalogs and insights.'}
                                </p>
                            </div>
                        )}

                        {error && <div className="form-error">{error}</div>}
                        {success && <div className="form-success">{success}</div>}

                        <button type="submit" className="login-submit" disabled={loading}>
                            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
                        </button>
                    </form>
                </div>
            </div>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

        .login-page {
          display: flex;
          height: 100vh;
          width: 100vw;
          font-family: 'DM Sans', sans-serif;
          background: #f4f3ef;
        }

        .login-left {
          width: 420px;
          min-width: 380px;
          background: #1a1917;
          display: flex;
          flex-direction: column;
          padding: 40px;
          position: relative;
          overflow: hidden;
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #f0ede6;
          font-size: 17px;
          font-weight: 600;
        }

        .login-brand svg { color: #c9a84c; }

        .login-tagline {
          margin-top: auto;
          margin-bottom: 40px;
          z-index: 1;
        }

        .login-tagline h2 {
          color: #f0ede6;
          font-size: 30px;
          font-weight: 700;
          letter-spacing: -0.8px;
          line-height: 1.2;
          margin: 0 0 12px;
        }

        .login-tagline p {
          color: #6b6866;
          font-size: 14px;
          line-height: 1.6;
          margin: 0;
        }

        .login-dots {
          position: absolute;
          bottom: 40px;
          right: 30px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .login-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #c9a84c;
          opacity: 0.25;
          animation: pulse-dot 2s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }

        .login-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .login-box {
          width: 100%;
          max-width: 400px;
        }

        .login-tabs {
          display: flex;
          gap: 0;
          margin-bottom: 28px;
          border-bottom: 1px solid #e0ddd5;
        }

        .login-tab {
          padding: 10px 0;
          margin-right: 24px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          color: #aaa89f;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
          margin-bottom: -1px;
        }

        .login-tab.active {
          color: #1a1917;
          border-bottom-color: #1a1917;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 500;
          color: #4a4844;
        }

        .form-group input {
          padding: 10px 14px;
          border: 1px solid #dedad0;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          color: #1a1917;
          background: #fff;
          outline: none;
          transition: border-color 0.15s;
        }

        .form-group input:focus {
          border-color: #c9a84c;
        }

        .input-icon-wrap {
          position: relative;
        }

        .input-icon-wrap input {
          width: 100%;
          box-sizing: border-box;
          padding-right: 40px;
        }

        .input-icon-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #aaa89f;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
        }

        .role-picker {
          display: flex;
          gap: 8px;
        }

        .role-btn {
          flex: 1;
          padding: 8px;
          border: 1px solid #dedad0;
          border-radius: 8px;
          background: #fff;
          font-family: inherit;
          font-size: 13px;
          color: #7a7872;
          cursor: pointer;
          transition: all 0.15s;
        }

        .role-btn.active {
          background: #1a1917;
          border-color: #1a1917;
          color: #c9a84c;
          font-weight: 600;
        }

        .role-hint {
          font-size: 12px;
          color: #aaa89f;
          margin: 0;
        }

        .form-error {
          background: #fdecea;
          border: 1px solid #f5c0bb;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: #b93030;
        }

        .form-success {
          background: #e6f4ea;
          border: 1px solid #b3debb;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: #2d7a3a;
        }

        .login-submit {
          width: 100%;
          padding: 12px;
          background: #1a1917;
          color: #f0ede6;
          border: none;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
          margin-top: 4px;
        }

        .login-submit:hover:not(:disabled) { background: #2d2b29; }
        .login-submit:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
        </div>
    )
}