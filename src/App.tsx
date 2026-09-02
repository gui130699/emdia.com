import { Suspense, lazy } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./stores/ToastContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Cards = lazy(() => import("./pages/Cards"));
const Goals = lazy(() => import("./pages/Goals"));
const Reports = lazy(() => import("./pages/Reports"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

function PageFallback() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-ink-400">
      Carregando...
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<SignUp />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Dashboard />
                  </Suspense>
                }
              />
              <Route
                path="/transacoes"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Transactions />
                  </Suspense>
                }
              />
              <Route
                path="/contas"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Accounts />
                  </Suspense>
                }
              />
              <Route
                path="/cartoes"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Cards />
                  </Suspense>
                }
              />
              <Route
                path="/metas"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Goals />
                  </Suspense>
                }
              />
              <Route
                path="/relatorios"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Reports />
                  </Suspense>
                }
              />
              <Route
                path="/configuracoes"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <SettingsPage />
                  </Suspense>
                }
              />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
