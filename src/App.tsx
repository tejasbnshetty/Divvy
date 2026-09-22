import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Landing from './pages/Landing'

// Route-level code splitting: Landing (the entry point for a brand-new visitor
// on mobile) stays in the main bundle; everything past it loads on demand.
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Join = lazy(() => import('./pages/Join'))
const GroupList = lazy(() => import('./pages/GroupList'))
const GroupDashboard = lazy(() => import('./pages/GroupDashboard'))
const AddExpense = lazy(() => import('./pages/AddExpense'))
const ExpenseDetail = lazy(() => import('./pages/ExpenseDetail'))
const SettleUp = lazy(() => import('./pages/SettleUp'))
const Members = lazy(() => import('./pages/Members'))
const Account = lazy(() => import('./pages/Account'))

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Suspense fallback={null}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/join/:code" element={<Join />} />
      <Route
        path="/groups"
        element={
          <RequireAuth>
            <GroupList />
          </RequireAuth>
        }
      />
      <Route
        path="/groups/:groupId"
        element={
          <RequireAuth>
            <GroupDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/groups/:groupId/expenses/new"
        element={
          <RequireAuth>
            <AddExpense />
          </RequireAuth>
        }
      />
      <Route
        path="/groups/:groupId/expenses/:expenseId"
        element={
          <RequireAuth>
            <ExpenseDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/groups/:groupId/settle"
        element={
          <RequireAuth>
            <SettleUp />
          </RequireAuth>
        }
      />
      <Route
        path="/groups/:groupId/members"
        element={
          <RequireAuth>
            <Members />
          </RequireAuth>
        }
      />
      <Route
        path="/account"
        element={
          <RequireAuth>
            <Account />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
