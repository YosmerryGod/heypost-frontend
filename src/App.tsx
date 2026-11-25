import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import AppLayout from "@/components/AppLayout";
import { AuthGate, PermissionGate, RoleGate } from "@/components/AuthGate"; // [MODIFIED]
import { Loading } from "@/components/Loading";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const AuthCallbackPage = lazy(() => import("@/pages/AuthCallbackPage"));
const PosPage = lazy(() => import("@/pages/PosPage"));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage"));
const ProductsPage = lazy(() => import("@/pages/ProductsPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const EmployeesPage = lazy(() => import("@/pages/EmployeesPage"));
const OutletsPage = lazy(() => import("@/pages/OutletsPage"));

export default function App() {
  return <>
    <Suspense fallback={<Loading />}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<AuthGate><AppLayout /></AuthGate>}>
        <Route path="/" element={<PermissionGate allow={["pos.access"]}><PosPage /></PermissionGate>} />
        <Route path="/transaksi" element={<PermissionGate allow={["history.daily.view"]}><TransactionsPage /></PermissionGate>} />
        <Route path="/produk" element={<PermissionGate allow={["menu.create", "menu.edit", "stock.edit"]}><ProductsPage /></PermissionGate>} />
        <Route path="/laporan" element={<PermissionGate allow={["reports.sales.view"]}><ReportsPage /></PermissionGate>} />
        <Route path="/karyawan" element={<RoleGate allow={["owner"]}><EmployeesPage /></RoleGate>} />
        <Route path="/outlet" element={<RoleGate allow={["owner"]}><OutletsPage /></RoleGate>} />
        <Route path="/pengaturan" element={<Navigate to="/outlet" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
    <Toaster position="top-center" richColors />
  </>;
}
