import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import AppLayout from "@/components/AppLayout";
import { Loading } from "@/components/Loading";

const PosPage = lazy(() => import("@/pages/PosPage"));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage"));
const ProductsPage = lazy(() => import("@/pages/ProductsPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));

export default function App() {
  return <>
    <Suspense fallback={<Loading />}><Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<PosPage />} />
        <Route path="/transaksi" element={<TransactionsPage />} />
        <Route path="/produk" element={<ProductsPage />} />
        <Route path="/laporan" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes></Suspense>
    <Toaster position="top-center" richColors />
  </>;
}
