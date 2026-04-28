/**
 * 路由守卫组件：
 *   - ProtectedRoute：未登录 → 跳转 /login
 *   - AdminRoute：非管理员 → 跳转 /（并显示权限不足提示）
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

/** 需要登录的路由守卫 */
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    // 保存跳转前路径，登录后跳回
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

/** 需要管理员权限的路由守卫 */
export function AdminRoute() {
  const user = useAuthStore((s) => s.user)

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
