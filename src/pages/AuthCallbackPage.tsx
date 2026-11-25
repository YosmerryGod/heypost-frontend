import { Navigate, Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { ErrorState, Loading } from "@/components/Loading";

export default function AuthCallbackPage() {
  const { data, isLoading, error, refetch } = useAuth();
  if (data) return <Navigate to="/" replace />;
  return <main className="auth-state auth-callback">
    <div className="auth-wordmark">hey<span>post</span><b>.</b></div>
    {isLoading ? <Loading label="Menyelesaikan masuk dengan Google…" /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : <div className="state-panel"><h1>Sesi belum ditemukan</h1><p>Autentikasi Google belum selesai atau sudah kedaluwarsa. Silakan coba kembali.</p><Link className="button primary" to="/login">Kembali ke halaman masuk</Link></div>}
  </main>;
}
