import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthGate } from './auth/AuthGate'
import { ImportPage } from './features/import/ImportPage'
import { QueuePage } from './features/queue/QueuePage'
import { RefCodeLookupPage } from './features/refcode/RefCodeLookupPage'
import { PipelinePage } from './features/pipeline/PipelinePage'
import { DashboardPage } from './features/dashboard/DashboardPage'

export default function App() {
  return (
    <AuthGate>
      <BrowserRouter>
        <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #ddd' }}>
          <NavLink to="/queue">送信キュー</NavLink>
          <NavLink to="/import">取り込み</NavLink>
          <NavLink to="/refcode">合言葉</NavLink>
          <NavLink to="/pipeline">パイプライン</NavLink>
          <NavLink to="/dashboard">ダッシュボード</NavLink>
        </nav>
        <main style={{ padding: 16 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/queue" replace />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/refcode" element={<RefCodeLookupPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="*" element={<Navigate to="/queue" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthGate>
  )
}
