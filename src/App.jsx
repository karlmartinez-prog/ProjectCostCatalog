import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

import PageWrapper from './components/layout/PageWrapper'
import Home from './pages/Home'
import ProjectCatalog from './pages/ProjectCatalog'
import ProjectDetail from './pages/ProjectDetail'
import ResourceCatalog from './pages/ResourceCatalog'
import Suppliers from './pages/Suppliers'
import Insights from './pages/Insights'
import Settings from './pages/Settings'
import Login from './pages/Login'

function ProtectedRoute({ session, children }) {
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          session ? <Navigate to="/" replace /> : <Login />
        } />
        <Route path="/" element={
          <ProtectedRoute session={session}>
            <PageWrapper session={session} />
          </ProtectedRoute>
        }>
          <Route index element={<Home />} />
          <Route path="projects" element={<ProjectCatalog />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="resources" element={<ResourceCatalog />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="insights" element={<Insights />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}