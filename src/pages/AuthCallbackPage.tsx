import { Navigate, Link, useSearchParams } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { ErrorState, Loading } from "@/components/Loading";

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const googleFailed = searchParams.get("error") === "google_login";
  const { data, isLoading, error, refetch } = useAuth();
  if (data) return <Navigate to="/" replace />;
  return <main className="auth-state auth-callback">
    <div className="auth-wordmark">hey<span>post</span><b>.</b></div>
    {googleFailed ? <div className="state-panel" role="alert"><h1>Login Google belum berhasil</h1><p>Backend tidak dapat menyelesaikan autentikasi Google. Silakan coba kembali atau periksa konfigurasi OAuth server.</p><Link className="button primary" to="/login">Kembali ke halaman masuk</Link></div> : isLoading ? <Loading label="Menyelesaikan masuk dengan Google…" /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : <div className="state-panel"><h1>Sesi belum ditemukan</h1><p>Autentikasi Google belum selesai atau sudah kedaluwarsa. Silakan coba kembali.</p><Link className="button primary" to="/login">Kembali ke halaman masuk</Link></div>}
  </main>;
}
