import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute, AdminRoute } from '@/routes/index'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import History from '@/pages/History'
import DeviceSettings from '@/pages/Settings/DeviceSettings'
import DeviceManagement from '@/pages/Settings/DeviceManagement'
import UserManagement from '@/pages/Settings/UserManagement'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

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
              <Route path="history" element={<History />} />
              <Route path="settings" element={<DeviceSettings />} />

              {/* 需要管理员 */}
              <Route element={<AdminRoute />}>
                <Route path="users"    element={<UserManagement />} />
                <Route path="devices"  element={<DeviceManagement />} />
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
