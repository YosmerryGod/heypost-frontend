import { useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ScanLine,
  ShieldCheck,
  Store,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { apiConfig } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { AuthSession } from "@/hooks/useAuth";
import { EmployeeBarcodeScanner } from "@/components/EmployeeBarcodeScanner";
import "./LoginPage.css";

type Mode = "login" | "register" | "employee";

function HeyPostBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`access-brand ${compact ? "access-brand-compact" : ""}`} aria-label="HeyPost">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <ellipse cx="10.5" cy="15" rx="4.2" ry="6" transform="rotate(-28 10.5 15)" />
        <ellipse cx="21" cy="9.5" rx="4.2" ry="6" transform="rotate(-8 21 9.5)" />
        <ellipse cx="32" cy="10.5" rx="4.2" ry="6" transform="rotate(14 32 10.5)" />
        <ellipse cx="40" cy="19" rx="4" ry="5.6" transform="rotate(32 40 19)" />
        <path d="M11.5 33.5c0-7 5.5-12.5 13-12.5s13 5.5 13 12.5c0 5.2-4.1 8.1-8.4 6.8-2.1-.65-3.2-1.4-4.6-1.4s-2.5.75-4.6 1.4c-4.3 1.3-8.4-1.6-8.4-6.8Z" />
      </svg>
      <span>HeyPost</span>
    </div>
  );
}

function GoogleMark() {
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.82h5.38a4.6 4.6 0 0 1-2 3.02v2.48h3.23c1.9-1.74 2.99-4.31 2.99-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.48c-.9.6-2.05.96-3.39.96-2.62 0-4.83-1.76-5.62-4.13H3.04v2.56A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.38 13.92A6 6 0 0 1 6.06 12c0-.67.12-1.32.31-1.92V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.34-2.56Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.34 2.56C7.17 7.72 9.38 5.96 12 5.96Z"/></svg>;
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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanSucceeded, setScanSucceeded] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const complete = (session: AuthSession) => {
    utils.auth.me.setData(undefined, session);
    navigate("/", { replace: true });
  };
  const login = trpc.auth.login.useMutation({ onSuccess: complete });
  const register = trpc.auth.register.useMutation({ onSuccess: complete });
  const employeeLogin = trpc.auth.employeeLogin.useMutation({ onSuccess: complete });

  if (!isLoading && data) return <Navigate to="/" replace />;

  const changeMode = (next: Mode) => {
    login.reset();
    register.reset();
    employeeLogin.reset();
    setScannerOpen(false);
    setScanSucceeded(false);
    setShowPassword(false);
    setMode(next);
    window.requestAnimationFrame(() => document.getElementById("access-title")?.focus({ preventScroll: true }));
  };
  const handleBarcodeScan = (barcode: string) => {
    employeeLogin.reset();
    setEmployee((current) => ({ ...current, barcode }));
    setScanSucceeded(true);
    setScannerOpen(false);
    window.setTimeout(() => pinInputRef.current?.focus(), 220);
  };
  const activeMutation = mode === "login" ? login : mode === "register" ? register : employeeLogin;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "login") login.mutate(owner);
    else if (mode === "register") register.mutate({ ...registration, outletName: registration.outletName || undefined });
    else employeeLogin.mutate(employee);
  };

  const title = mode === "employee" ? "Akses karyawan" : mode === "register" ? "Mulai bisnis Anda" : "Selamat datang kembali!";
  const description = mode === "employee"
    ? "Pindai kartu akses dari owner, lalu masukkan PIN 6 digit untuk melanjutkan."
    : mode === "register"
      ? "Buat akun owner, toko, dan outlet pertama dalam satu langkah."
      : "Masuk ke workspace HeyPost untuk melanjutkan aktivitas bisnismu.";

  return (
    <main className="access-page">
      <div className="access-trust"><ShieldCheck size={19} strokeWidth={2.4} /><span>Aman &amp; Terpercaya</span></div>

      <section className="access-hero" aria-label="Tentang HeyPost">
        <HeyPostBrand />
        <div className="access-hero-copy">
          <h1>Kelola bisnis<br /><span>lebih mudah.</span></h1>
          <p>Satu aplikasi untuk kasir, stok,<br className="access-desktop-break" /> dan laporan bisnismu.</p>
        </div>
        <img
          className="access-illustration"
          src="/images/heypost-pos-illustration.svg"
          width="700"
          height="475"
          alt="Ilustrasi maskot HeyPost menggunakan mesin kasir"
          fetchPriority="high"
        />
      </section>

      <section className="access-workspace" aria-label="Autentikasi akun">
        <div className="access-card">
          <div className="access-card-brand"><HeyPostBrand compact /></div>
          <header className="access-heading">
            <h2 id="access-title" tabIndex={-1}>{title}</h2>
            <p>{description}</p>
          </header>

          <form className="access-form" onSubmit={submit}>
            {mode === "register" && <>
              <div className="access-field-pair">
                <div className="access-field">
                  <label htmlFor="register-name">Nama owner</label>
                  <div className="access-input"><UserRound size={19} aria-hidden="true" /><input id="register-name" required minLength={2} maxLength={100} autoComplete="name" value={registration.name} onChange={(event) => setRegistration({ ...registration, name: event.target.value })} placeholder="Nama lengkap" /></div>
                </div>
                <div className="access-field">
                  <label htmlFor="register-store">Nama toko</label>
                  <div className="access-input"><Store size={19} aria-hidden="true" /><input id="register-store" required minLength={2} maxLength={120} autoComplete="organization" value={registration.storeName} onChange={(event) => setRegistration({ ...registration, storeName: event.target.value })} placeholder="Contoh: Kopi Pagi" /></div>
                </div>
              </div>
              <div className="access-field">
                <label htmlFor="register-outlet">Outlet pertama</label>
                <div className="access-input"><Store size={19} aria-hidden="true" /><input id="register-outlet" required minLength={2} maxLength={120} value={registration.outletName} onChange={(event) => setRegistration({ ...registration, outletName: event.target.value })} placeholder="Outlet Utama" /></div>
              </div>
            </>}

            {mode !== "employee" ? <>
              <div className="access-field">
                <label htmlFor={`${mode}-email`}>Email</label>
                <div className="access-input"><Mail size={19} aria-hidden="true" /><input id={`${mode}-email`} required type="email" maxLength={320} autoComplete="email" value={mode === "login" ? owner.email : registration.email} onChange={(event) => mode === "login" ? setOwner({ ...owner, email: event.target.value }) : setRegistration({ ...registration, email: event.target.value })} placeholder="nama@email.com" /></div>
              </div>
              <div className="access-field">
                <label htmlFor={`${mode}-password`}>Password</label>
                <div className="access-input access-password"><LockKeyhole size={19} aria-hidden="true" /><input id={`${mode}-password`} required type={showPassword ? "text" : "password"} minLength={mode === "register" ? 8 : 1} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} value={mode === "login" ? owner.password : registration.password} onChange={(event) => mode === "login" ? setOwner({ ...owner, password: event.target.value }) : setRegistration({ ...registration, password: event.target.value })} placeholder={mode === "register" ? "Minimal 8 karakter" : "Masukkan password"} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
              </div>
            </> : <>
              <button className="access-button access-scan scan-employee-button" type="button" onClick={() => { employeeLogin.reset(); setScannerOpen(true); }} disabled={employeeLogin.isPending}>
                <ScanLine size={20} /> Pindai QR kartu akses <ArrowRight size={19} />
              </button>
              {scanSucceeded && <p className="scan-success" role="status"><CircleCheck size={18} /><span>Barcode terisi otomatis. Masukkan PIN 6 digit, lalu tekan Masuk.</span></p>}
              <div className="access-form-divider"><span>atau isi manual</span></div>
              <div className="access-field">
                <label htmlFor="employee-barcode">Barcode karyawan</label>
                <div className="access-input"><KeyRound size={19} aria-hidden="true" /><input id="employee-barcode" required minLength={20} maxLength={512} autoComplete="off" spellCheck={false} value={employee.barcode} onChange={(event) => { setScanSucceeded(false); setEmployee({ ...employee, barcode: event.target.value.trim() }); }} placeholder="Tempel kode barcode dari owner" /></div>
              </div>
              <div className="access-field">
                <label htmlFor="employee-pin">PIN 6 digit</label>
                <div className="access-input"><LockKeyhole size={19} aria-hidden="true" /><input ref={pinInputRef} id="employee-pin" required type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="current-password" value={employee.pin} onChange={(event) => setEmployee({ ...employee, pin: event.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="••••••" /></div>
              </div>
            </>}

            {activeMutation.error && <p className="form-error" role="alert">{activeMutation.error.message}</p>}
            <button className="access-button access-primary" type="submit" disabled={activeMutation.isPending || (mode === "employee" && employee.pin.length !== 6)}>
              <span>{activeMutation.isPending ? "Memproses…" : mode === "register" ? "Buat akun & buka toko" : "Masuk ke HeyPost"}</span><ArrowRight size={20} />
            </button>
          </form>

          {mode !== "employee" ? <>
            <div className="access-divider"><span>ATAU</span></div>
            <div className="access-secondary-actions">
              <a className="access-button access-google" href={apiConfig.googleLoginUrl} aria-label="Masuk dengan Google"><GoogleMark /><span className="access-action-full">Masuk dengan Google</span><span className="access-action-short">Google</span></a>
              <button className="access-button access-employee" type="button" onClick={() => changeMode("employee")} aria-label="Masuk sebagai Karyawan"><UsersRound size={21} /><span className="access-action-full">Masuk sebagai Karyawan</span><span className="access-action-short">Karyawan</span></button>
            </div>
            <p className="access-switch">{mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"} <button type="button" onClick={() => changeMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Daftar sekarang" : "Masuk di sini"}</button></p>
          </> : <button className="access-back" type="button" onClick={() => changeMode("login")}><ArrowLeft size={18} /> Kembali ke login owner</button>}

          {mode === "employee" && scannerOpen && <EmployeeBarcodeScanner open onOpenChange={setScannerOpen} onScan={handleBarcodeScan} />}
        </div>
        <p className="access-footer">Kelola bisnis Anda dengan lebih efisien bersama HeyPost.</p>
      </section>
    </main>
  );
}
