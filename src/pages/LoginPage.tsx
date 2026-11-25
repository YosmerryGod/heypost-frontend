import { useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Store, UserRound } from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { apiConfig } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { AuthSession } from "@/hooks/useAuth";

type Mode = "login" | "register" | "employee";
const modes: { id: Mode; label: string }[] = [
  { id: "login", label: "Masuk" },
  { id: "register", label: "Daftar" },
  { id: "employee", label: "Karyawan" },
];

function GoogleMark() {
  return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.82h5.38a4.6 4.6 0 0 1-2 3.02v2.48h3.23c1.9-1.74 2.99-4.31 2.99-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.48c-.9.6-2.05.96-3.39.96-2.62 0-4.83-1.76-5.62-4.13H3.04v2.56A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.38 13.92A6 6 0 0 1 6.06 12c0-.67.12-1.32.31-1.92V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.34-2.56Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.34 2.56C7.17 7.72 9.38 5.96 12 5.96Z"/></svg>;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [owner, setOwner] = useState({ email: "", password: "" });
  const [registration, setRegistration] = useState({ name: "", storeName: "", outletName: "Outlet Utama", email: "", password: "" });
  const [employee, setEmployee] = useState({ barcode: "", pin: "" });

  const complete = (session: AuthSession) => {
    utils.auth.me.setData(undefined, session);
    navigate("/", { replace: true });
  };
  const login = trpc.auth.login.useMutation({ onSuccess: complete });
  const register = trpc.auth.register.useMutation({ onSuccess: complete });
  const employeeLogin = trpc.auth.employeeLogin.useMutation({ onSuccess: complete });

  if (!isLoading && data) return <Navigate to="/" replace />;

  const changeMode = (next: Mode) => {
    login.reset(); register.reset(); employeeLogin.reset();
    setMode(next);
  };
  const activeMutation = mode === "login" ? login : mode === "register" ? register : employeeLogin;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "login") login.mutate(owner);
    else if (mode === "register") register.mutate({ ...registration, outletName: registration.outletName || undefined });
    else employeeLogin.mutate(employee);
  };

  return <main className="auth-layout">
    <section className="auth-intro" aria-label="Tentang heypost">
      <div className="auth-wordmark">hey<span>post</span><b>.</b></div>
      <div className="auth-intro-copy">
        <span className="section-kicker">RUANG KERJA TOKO</span>
        <h1>Satu akun.<br />Setiap cabang tetap teratur.</h1>
        <p>Kelola menu, stok, transaksi, dan tim dengan hak akses yang jelas untuk setiap outlet.</p>
      </div>
      <div className="auth-intro-notes">
        <div><Store size={19} /><span><strong>Owner</strong> mengelola toko dan seluruh cabang.</span></div>
        <div><UserRound size={19} /><span><strong>Manager</strong> menjalankan operasional outletnya.</span></div>
        <div><KeyRound size={19} /><span><strong>Kasir</strong> fokus pada pesanan dan pembayaran.</span></div>
      </div>
    </section>
    <section className="auth-workspace">
      <div className="auth-mobile-brand">hey<span>post</span><b>.</b></div>
      <div className="auth-panel">
        <header className="auth-heading">
          <span className="section-kicker">{mode === "employee" ? "AKSES TIM" : mode === "register" ? "MULAI BERJUALAN" : "SELAMAT DATANG KEMBALI"}</span>
          <h2>{mode === "employee" ? "Masuk sebagai karyawan" : mode === "register" ? "Buat toko baru" : "Masuk ke heypost"}</h2>
          <p>{mode === "employee" ? "Gunakan barcode dan PIN yang diberikan owner." : mode === "register" ? "Satu toko dan outlet pertama akan dibuat untuk Anda." : "Masuk sebagai owner atau lanjutkan dengan Google."}</p>
        </header>
        <div className="auth-tabs" role="tablist" aria-label="Pilihan akses akun">
          {modes.map((item) => <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? "active" : ""} onClick={() => changeMode(item.id)}>{item.label}</button>)}
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <>
            <label>Nama owner<input required minLength={2} maxLength={100} autoComplete="name" value={registration.name} onChange={(event) => setRegistration({ ...registration, name: event.target.value })} placeholder="Nama lengkap" /></label>
            <div className="auth-form-row">
              <label>Nama toko<input required minLength={2} maxLength={120} autoComplete="organization" value={registration.storeName} onChange={(event) => setRegistration({ ...registration, storeName: event.target.value })} placeholder="Contoh: Kopi Pagi" /></label>
              <label>Outlet pertama<input required minLength={2} maxLength={120} value={registration.outletName} onChange={(event) => setRegistration({ ...registration, outletName: event.target.value })} placeholder="Outlet Utama" /></label>
            </div>
          </>}
          {mode !== "employee" ? <>
            <label>Email<input required type="email" maxLength={320} autoComplete="email" value={mode === "login" ? owner.email : registration.email} onChange={(event) => mode === "login" ? setOwner({ ...owner, email: event.target.value }) : setRegistration({ ...registration, email: event.target.value })} placeholder="nama@toko.com" /></label>
            <label>Password<span className="password-field"><input required type={showPassword ? "text" : "password"} minLength={mode === "register" ? 8 : 1} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} value={mode === "login" ? owner.password : registration.password} onChange={(event) => mode === "login" ? setOwner({ ...owner, password: event.target.value }) : setRegistration({ ...registration, password: event.target.value })} placeholder={mode === "register" ? "Minimal 8 karakter" : "Password Anda"} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
          </> : <>
            <label>Barcode karyawan<input required minLength={20} maxLength={512} autoComplete="off" spellCheck={false} value={employee.barcode} onChange={(event) => setEmployee({ ...employee, barcode: event.target.value.trim() })} placeholder="Tempel kode barcode dari owner" /></label>
            <label>PIN 6 digit<input required type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="current-password" value={employee.pin} onChange={(event) => setEmployee({ ...employee, pin: event.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="••••••" /></label>
          </>}
          {activeMutation.error && <p className="form-error" role="alert">{activeMutation.error.message}</p>}
          <button className="button primary auth-submit" type="submit" disabled={activeMutation.isPending || (mode === "employee" && employee.pin.length !== 6)}>{activeMutation.isPending ? "Memproses…" : mode === "register" ? "Buat akun & buka toko" : "Masuk"}</button>
        </form>
        {mode !== "employee" && <>
          <div className="auth-divider"><span>atau</span></div>
          <a className="button secondary google-button" href={apiConfig.googleLoginUrl}><GoogleMark /> Lanjutkan dengan Google</a>
          <p className="auth-footnote">Google akan membuka akun owner. Akses karyawan tetap memakai barcode dan PIN.</p>
        </>}
      </div>
      <p className="auth-privacy">Sesi aman tersimpan di perangkat ini. Keluar setelah memakai perangkat bersama.</p>
    </section>
  </main>;
}
