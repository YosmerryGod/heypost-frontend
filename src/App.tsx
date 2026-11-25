import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import AppLayout from "@/components/AppLayout";
import { AuthGate, RoleGate } from "@/components/AuthGate";
import { Loading } from "@/components/Loading";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const AuthCallbackPage = lazy(() => import("@/pages/AuthCallbackPage"));
const PosPage = lazy(() => import("@/pages/PosPage"));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage"));
const ProductsPage = lazy(() => import("@/pages/ProductsPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const ExpensesPage = lazy(() => import("@/pages/ExpensesPage")); // [ADDED]

export default function App() {
  return <>
    <Suspense fallback={<Loading />}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<AuthGate><AppLayout /></AuthGate>}>
        <Route path="/" element={<PosPage />} />
        <Route path="/transaksi" element={<TransactionsPage />} />
        <Route path="/produk" element={<RoleGate allow={["owner", "manager"]}><ProductsPage /></RoleGate>} />
        <Route path="/laporan" element={<RoleGate allow={["owner", "manager"]}><ReportsPage /></RoleGate>} />
        <Route path="/pengeluaran" element={<RoleGate allow={["owner", "manager"]}><ExpensesPage /></RoleGate>} /> {/* [ADDED] */}
        <Route path="/pengaturan" element={<RoleGate allow={["owner"]}><SettingsPage /></RoleGate>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
    <Toaster position="top-center" richColors />
  </>;
}
