import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Copy, KeyRound, Pencil, Plus, Printer, RefreshCw, Search, UserRound } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/Loading";
import { formatDate } from "@/lib/format";

type EmployeeRole = "manager" | "kasir";
type EmployeeForm = { id?: number; name: string; role: EmployeeRole; outletId: number; pin: string; active: boolean };
type Credential = { name: string; barcode: string; pin?: string };

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Kode barcode disalin");
  } catch {
    toast.error("Tidak dapat menyalin otomatis. Pilih dan salin kode secara manual.");
  }
}

export default function EmployeesPanel() {
  const { data: session } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading, error, refetch } = trpc.employees.list.useQuery();
  const [search, setSearch] = useState("");
  const [now] = useState(Date.now);
  const [form, setForm] = useState<EmployeeForm | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const outlets = session?.outlets ?? [];
  const refresh = () => { void utils.employees.list.invalidate(); };
  const create = trpc.employees.create.useMutation({
    onSuccess: (employee, variables) => {
      setForm(null); refresh();
      setCredential({ name: employee.name, barcode: employee.barcode, pin: variables.pin });
      toast.success("Karyawan berhasil ditambahkan");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const update = trpc.employees.update.useMutation({
    onSuccess: () => { setForm(null); refresh(); toast.success("Data karyawan diperbarui. Sesi lama telah ditutup."); },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const regenerate = trpc.employees.regenerateBarcode.useMutation({
    onSuccess: (result, variables) => {
      refresh();
      const employee = data?.find((item) => item.id === variables.id);
      setCredential({ name: employee?.name ?? "Karyawan", barcode: result.barcode });
      toast.success("Barcode baru dibuat. Sesi lama telah ditutup.");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const filtered = useMemo(() => (data ?? []).filter((employee) => `${employee.name} ${employee.outletName} ${employee.role}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const openCreate = () => setForm({ name: "", role: "kasir", outletId: session?.activeOutletId ?? outlets[0]?.id ?? 0, pin: "", active: true });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form || !form.outletId) { toast.error("Pilih outlet untuk karyawan"); return; }
    if (form.id) update.mutate({ id: form.id, name: form.name, role: form.role, outletId: form.outletId, active: form.active, pin: form.pin || undefined });
    else create.mutate({ name: form.name, role: form.role, outletId: form.outletId, pin: form.pin });
  };
  const pending = create.isPending || update.isPending;

  return <section className="settings-section" aria-labelledby="employee-list-title">
    <div className="settings-section-head"><div><h2 id="employee-list-title">Akses karyawan</h2><p>Setiap karyawan hanya ditugaskan ke satu outlet dan masuk dengan barcode + PIN.</p></div><button className="button primary" onClick={openCreate}><Plus size={18} /> Tambah karyawan</button></div>
    <div className="list-toolbar employee-toolbar"><label className="search-field"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, role, atau outlet…" aria-label="Cari karyawan" /></label><span>{filtered.length} karyawan</span></div>
    {isLoading ? <Loading label="Memuat daftar karyawan…" /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : filtered.length === 0 ? <div className="state-panel employee-empty"><UserRound size={30} /><h3>{data?.length ? "Karyawan tidak ditemukan" : "Belum ada karyawan"}</h3><p>{data?.length ? "Coba kata kunci pencarian lain." : "Tambahkan manager atau kasir, lalu berikan kartu aksesnya."}</p>{!data?.length && <button className="button primary" onClick={openCreate}>Tambah karyawan pertama</button>}</div> : <div className="settings-list employee-list">
      {filtered.map((employee) => {
        const locked = employee.lockedUntil && employee.lockedUntil.getTime() > now;
        return <article className="settings-row employee-row" key={employee.id}>
          <div className="settings-row-icon"><UserRound size={20} /></div>
          <div className="settings-row-main"><div><h3>{employee.name}</h3><span className={`role-badge ${employee.role}`}>{employee.role === "manager" ? "Manager" : "Kasir"}</span><span className={`status-badge ${employee.active ? "active" : "inactive"}`}>{employee.active ? "Aktif" : "Nonaktif"}</span></div><p>{employee.outletName}</p><small className="employee-login-meta">{locked ? "Login dikunci sementara" : employee.lastLoginAt ? `Masuk ${formatDate(employee.lastLoginAt)}` : "Belum pernah masuk"}</small></div>
          <div className="settings-row-actions"><button className="icon-button subtle" onClick={() => setForm({ id: employee.id, name: employee.name, role: employee.role, outletId: employee.outletId, pin: "", active: employee.active })} aria-label={`Edit ${employee.name}`}><Pencil size={17} /></button><button className="button secondary barcode-reset" disabled={regenerate.isPending} onClick={() => { if (window.confirm(`Buat barcode baru untuk ${employee.name}? Barcode lama dan sesi aktifnya tidak akan berlaku.`)) regenerate.mutate({ id: employee.id }); }}><RefreshCw size={16} /> Barcode baru</button></div>
        </article>;
      })}
    </div>}
    <div className="settings-note"><KeyRound size={18} /><p>Demi keamanan, backend hanya menyimpan hash barcode dan PIN. Barcode lengkap hanya muncul sekali saat dibuat atau diganti.</p></div>
    <Dialog open={!!form} onOpenChange={(open) => { if (!open && !pending) setForm(null); }}><DialogContent className="settings-dialog">{form && <form onSubmit={submit}>
      <DialogTitle>{form.id ? "Edit karyawan" : "Tambah karyawan"}</DialogTitle><DialogDescription>{form.id ? "Perubahan akses akan menutup sesi karyawan yang sedang aktif." : "Buat akses untuk satu outlet. Kartu barcode muncul setelah disimpan."}</DialogDescription>
      <div className="form-grid"><label className="full">Nama karyawan<input required minLength={2} maxLength={100} autoComplete="off" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nama lengkap" /></label><label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as EmployeeRole })}><option value="kasir">Kasir</option><option value="manager">Manager</option></select></label><label>Outlet<select required value={form.outletId} onChange={(event) => setForm({ ...form, outletId: Number(event.target.value) })}><option value={0} disabled>Pilih outlet</option>{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label><label className="full">{form.id ? "PIN baru (opsional)" : "PIN 6 digit"}<input required={!form.id} type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={form.id ? undefined : 6} maxLength={6} autoComplete="new-password" value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder={form.id ? "Kosongkan jika tidak diganti" : "6 digit angka"} /><small>{form.id ? "Mengisi PIN baru juga akan membuka kunci login dan menutup sesi lama." : "Jangan gunakan PIN yang mudah ditebak seperti 123456."}</small></label>{form.id && <label className="checkbox-field full"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span><strong>Akses aktif</strong><small>Karyawan nonaktif tidak dapat masuk dan sesi lamanya ditutup.</small></span></label>}</div>
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setForm(null)}>Batal</button><button type="submit" className="button primary" disabled={pending || (!form.id && form.pin.length !== 6) || (!!form.id && !!form.pin && form.pin.length !== 6)}>{pending ? "Menyimpan…" : form.id ? "Simpan perubahan" : "Buat kartu akses"}</button></div>
    </form>}</DialogContent></Dialog>
    <Dialog open={!!credential} onOpenChange={(open) => { if (!open) setCredential(null); }}><DialogContent className="credential-dialog">{credential && <>
      <DialogTitle>Kartu akses karyawan</DialogTitle><DialogDescription>Simpan kartu ini sekarang. Barcode lengkap tidak dapat ditampilkan kembali setelah dialog ditutup.</DialogDescription>
      <div className="credential-card"><div className="credential-brand">hey<span>post</span>.</div><QRCodeSVG value={credential.barcode} size={176} level="M" marginSize={2} /><h3>{credential.name}</h3><p>Barcode login</p><code>{credential.barcode}</code>{credential.pin && <div className="credential-pin"><span>PIN</span><strong>{credential.pin}</strong></div>}<small>Masuk melalui tab Karyawan, lalu masukkan barcode dan PIN.</small></div>
      <div className="credential-actions"><button className="button secondary" onClick={() => copyText(credential.barcode)}><Copy size={17} /> Salin kode</button><button className="button secondary" onClick={() => window.print()}><Printer size={17} /> Cetak kartu</button></div>
      <button className="button primary full-width" onClick={() => setCredential(null)}>Selesai, saya sudah menyimpannya</button>
    </>}</DialogContent></Dialog>
  </section>;
}
