import { useState } from "react";
import type { FormEvent } from "react";
import { Building2, MapPin, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type OutletForm = { id?: number; name: string; address: string; copyMenuFromOutletId: number };

export default function OutletsPanel() {
  const { data: session } = useAuth();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<OutletForm | null>(null);
  const refresh = () => { void utils.auth.me.invalidate(); void utils.pos.invalidate(); };
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
    if (form.id) update.mutate({ id: form.id, name: form.name, address: form.address || null });
    else create.mutate({ name: form.name, address: form.address || undefined, copyMenuFromOutletId: form.copyMenuFromOutletId || undefined });
  };
  const pending = create.isPending || update.isPending;

  return <section className="settings-section" aria-labelledby="outlet-list-title">
    <div className="settings-section-head"><div><h2 id="outlet-list-title">Daftar outlet</h2><p>Menu, stok, transaksi, dan laporan mengikuti outlet yang sedang dibuka.</p></div><button className="button primary" onClick={() => setForm({ name: "", address: "", copyMenuFromOutletId: session.activeOutletId })}><Plus size={18} /> Tambah outlet</button></div>
    <div className="settings-list">
      {session.outlets.map((outlet) => <article className="settings-row outlet-row" key={outlet.id}>
        <div className="settings-row-icon"><Building2 size={20} /></div>
        <div className="settings-row-main"><div><h3>{outlet.name}</h3>{session.activeOutletId === outlet.id && <span className="status-badge active">Sedang dibuka</span>}</div><p>{outlet.address || "Alamat belum diisi"}</p></div>
        <div className="settings-row-actions">
          {session.activeOutletId !== outlet.id && <button className="button secondary" disabled={switchOutlet.isPending} onClick={() => switchOutlet.mutate({ outletId: outlet.id })}>Buka outlet</button>}
          <button className="icon-button subtle" onClick={() => setForm({ id: outlet.id, name: outlet.name, address: outlet.address ?? "", copyMenuFromOutletId: 0 })} aria-label={`Edit ${outlet.name}`}><Pencil size={17} /></button>
        </div>
      </article>)}
    </div>
    <div className="settings-note"><MapPin size={18} /><p>Untuk memeriksa cabang lain, pilih <strong>Buka outlet</strong> atau gunakan pemilih outlet di bagian atas. Data antar-outlet tidak bercampur.</p></div>
    <Dialog open={!!form} onOpenChange={(open) => { if (!open && !pending) setForm(null); }}><DialogContent className="settings-dialog">{form && <form onSubmit={submit}>
      <DialogTitle>{form.id ? "Edit outlet" : "Tambah outlet"}</DialogTitle><DialogDescription>{form.id ? "Perbarui nama dan alamat cabang." : "Cabang baru memiliki katalog, stok, dan laporan sendiri."}</DialogDescription>
      <div className="form-grid"><label className="full">Nama outlet<input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Contoh: Cabang Tebet" /></label><label className="full">Alamat<textarea rows={3} maxLength={300} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Alamat lengkap (opsional)" /></label>{!form.id && <label className="full">Isi menu awal<select value={form.copyMenuFromOutletId} onChange={(event) => setForm({ ...form, copyMenuFromOutletId: Number(event.target.value) })}><option value={0}>Mulai dengan katalog kosong</option>{session.outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>Salin menu dari {outlet.name}</option>)}</select><small>Penyalinan mencakup kategori, produk, harga, dan stok saat ini.</small></label>}</div>
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setForm(null)}>Batal</button><button type="submit" className="button primary" disabled={pending}>{pending ? "Menyimpan…" : form.id ? "Simpan perubahan" : "Buat outlet"}</button></div>
    </form>}</DialogContent></Dialog>
  </section>;
}
