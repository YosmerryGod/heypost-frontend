import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useOutletContext } from "react-router";
import { Building2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type OutletForm = { id?: number; name: string; address: string; whatsappNumber: string; copyMenuFromOutletId: number };

export default function OutletsPanel() {
  const { data: session } = useAuth();
  const utils = trpc.useUtils();
  const { mobileSearchQuery } = useOutletContext<{ mobileSearchQuery: string }>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [form, setForm] = useState<OutletForm | null>(null);
  const refresh = () => { void utils.auth.me.invalidate(); void utils.pos.invalidate(); };
  const openCreate = () => setForm({ name: "", address: "", whatsappNumber: "", copyMenuFromOutletId: session?.activeOutletId ?? 0 });
  useEffect(() => {
    const add = (event: Event) => { if ((event as CustomEvent).detail === "/outlet") openCreate(); };
    const filter = (event: Event) => { if ((event as CustomEvent).detail === "/outlet") setFilterOpen(true); };
    window.addEventListener("heypost:admin-add", add);
    window.addEventListener("heypost:admin-filter", filter);
    return () => { window.removeEventListener("heypost:admin-add", add); window.removeEventListener("heypost:admin-filter", filter); };
  }, [session]);
  const create = trpc.store.createOutlet.useMutation({
    onSuccess: (outlet) => { setForm(null); refresh(); toast.success(`${outlet.name} berhasil dibuat`); },
    onError: (error) => toast.error(error.message),
  });
  const update = trpc.store.updateOutlet.useMutation({
    onSuccess: () => { setForm(null); refresh(); toast.success("Informasi outlet disimpan"); },
    onError: (error) => toast.error(error.message),
  });
  const switchOutlet = trpc.store.switchOutlet.useMutation({
    onSuccess: (_, variables) => {
      utils.auth.me.setData(undefined, (current) => current ? { ...current, activeOutletId: variables.outletId } : current);
      void utils.pos.invalidate();
      toast.success("Outlet aktif diganti");
    },
    onError: (error) => toast.error(error.message),
  });
  if (!session) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    if (form.id) update.mutate({ id: form.id, name: form.name, address: form.address || null, whatsappNumber: form.whatsappNumber || null });
    else create.mutate({ name: form.name, address: form.address || undefined, whatsappNumber: form.whatsappNumber || undefined, copyMenuFromOutletId: form.copyMenuFromOutletId || undefined });
  };
  const pending = create.isPending || update.isPending;

  return <section className="settings-section">
    <div className="settings-section-head"><span>{session.outlets.filter((outlet) => outlet.name.toLowerCase().includes(mobileSearchQuery.toLowerCase()) && (statusFilter === "all" || (statusFilter === "active" ? outlet.active : !outlet.active))).length} outlet</span></div>
    <div className="settings-list">
      {session.outlets.filter((outlet) => outlet.name.toLowerCase().includes(mobileSearchQuery.toLowerCase()) && (statusFilter === "all" || (statusFilter === "active" ? outlet.active : !outlet.active))).map((outlet) => <article className="settings-row outlet-row" key={outlet.id}>
        <div className="settings-row-icon"><Building2 size={20} /></div>
        <div className="settings-row-main"><div><h3>{outlet.name}</h3>{session.activeOutletId === outlet.id && <span className="status-badge active">Sedang dibuka</span>}</div><p>{outlet.address || "Alamat belum diisi"}</p>{outlet.whatsappNumber && <p>WhatsApp: {outlet.whatsappNumber}</p>}</div>
        <div className="settings-row-actions">
          {session.activeOutletId !== outlet.id && <button className="button secondary" disabled={switchOutlet.isPending} onClick={() => switchOutlet.mutate({ outletId: outlet.id })}>Buka outlet</button>}
          <button className="icon-button subtle" onClick={() => setForm({ id: outlet.id, name: outlet.name, address: outlet.address ?? "", whatsappNumber: outlet.whatsappNumber ?? "", copyMenuFromOutletId: 0 })} aria-label={`Edit ${outlet.name}`}><Pencil size={17} /></button>
        </div>
      </article>)}
    </div>
    <Dialog open={filterOpen} onOpenChange={setFilterOpen}><DialogContent className="settings-dialog"><DialogTitle>Filter outlet</DialogTitle><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}><option value="all">Semua outlet</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label><div className="dialog-actions"><button className="button secondary" onClick={() => setStatusFilter("all")}>Reset</button><button className="button primary" onClick={() => setFilterOpen(false)}>Terapkan</button></div></DialogContent></Dialog>
    <Dialog open={!!form} onOpenChange={(open) => { if (!open && !pending) setForm(null); }}><DialogContent className="settings-dialog">{form && <form onSubmit={submit}>
      <DialogTitle>{form.id ? "Edit outlet" : "Tambah outlet"}</DialogTitle><DialogDescription>{form.id ? "Perbarui nama, alamat, dan nomor WhatsApp cabang." : "Cabang baru memiliki katalog, stok, dan laporan sendiri."}</DialogDescription>
      <div className="form-grid"><label className="full">Nama outlet<input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Contoh: Cabang Tebet" /></label><label className="full">Alamat<textarea rows={3} maxLength={300} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Alamat lengkap (opsional)" /></label><label className="full">Nomor WhatsApp outlet<input type="tel" maxLength={30} value={form.whatsappNumber} onChange={(event) => setForm({ ...form, whatsappNumber: event.target.value })} placeholder="Contoh: 6281234567890" /><small>Gunakan kode negara, misalnya 62. Nomor ini dapat dicetak pada struk.</small></label>{!form.id && <label className="full">Isi menu awal<select value={form.copyMenuFromOutletId} onChange={(event) => setForm({ ...form, copyMenuFromOutletId: Number(event.target.value) })}><option value={0}>Mulai dengan katalog kosong</option>{session.outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>Salin menu dari {outlet.name}</option>)}</select><small>Penyalinan mencakup kategori, produk, harga, dan stok saat ini.</small></label>}</div>
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setForm(null)}>Batal</button><button type="submit" className="button primary" disabled={pending}>{pending ? "Menyimpan…" : form.id ? "Simpan perubahan" : "Buat outlet"}</button></div>
    </form>}</DialogContent></Dialog>
  </section>;
}
