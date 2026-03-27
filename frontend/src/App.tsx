import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute, AdminRoute } from '@/routes/index'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

// ── 占位页面（Phase 9-10 会替换） ─────────────────────────────────────────────

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="font-display text-sm tracking-widest text-text-secondary uppercase">
        {title} — Coming Soon
      </p>
    </div>
  )
}

// ── 路由配置 ──────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<Login />} />

          {/* 需要登录 */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="history" element={<PlaceholderPage title="历史数据" />} />
              <Route path="settings" element={<PlaceholderPage title="系统设置" />} />

              {/* 需要管理员 */}
              <Route element={<AdminRoute />}>
                <Route path="users" element={<PlaceholderPage title="用户管理" />} />
              </Route>
            </Route>
          </Route>

          {/* 兜底：重定向到首页 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
