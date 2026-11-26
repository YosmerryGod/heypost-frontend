import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { Building2, Check, CreditCard, ImagePlus, Printer, ReceiptText, Settings, UsersRound, Bluetooth, RefreshCw } from "lucide-react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";

type SettingsItem = { label: string; description: string; icon: typeof Building2; to?: string };
const settingsGroups: { title: string; items: SettingsItem[] }[] = [
  { title: "TOKO", items: [
    { label: "Outlet", description: "Kelola cabang, alamat, dan WhatsApp", icon: Building2, to: "/outlet" },
    { label: "Karyawan", description: "Kelola akun dan hak akses tim", icon: UsersRound, to: "/karyawan" },
  ] },
  { title: "TRANSAKSI", items: [
    { label: "Pengaturan Struk", description: "Logo, identitas, informasi, dan footer struk", icon: ReceiptText, to: "/pengaturan/struk" },
    { label: "Printer", description: "Hubungkan printer dan preferensi perangkat", icon: Printer, to: "/pengaturan/printer" },
    { label: "Pembayaran", description: "Metode pembayaran yang diterima", icon: CreditCard },
  ] },
  { title: "APLIKASI", items: [{ label: "Preferensi", description: "Pengaturan dan perilaku aplikasi", icon: Settings }] },
];

type ReceiptDraft = {
  showLogo: boolean; showStoreName: boolean; showOutletName: boolean; showAddress: boolean;
  showWhatsapp: boolean; showCashier: boolean; showCustomer: boolean; showHeyPostWatermark: boolean;
  footerMessage: string;
};
type PrinterPrefs = { deviceId: string; deviceName: string; paperWidth: "58" | "80"; copies: number; autoPrint: boolean };
const defaultPrinter: PrinterPrefs = { deviceId: "", deviceName: "", paperWidth: "58", copies: 1, autoPrint: false };
const printerStorageKey = "heypost:printer-preferences:v1";

export default function SettingsPage() {
  const location = useLocation();
  const isHub = location.pathname === "/pengaturan";
  const isReceipt = location.pathname === "/pengaturan/struk";
  const isPrinter = location.pathname === "/pengaturan/printer";
  const { data: session } = useAuth();
  const utils = trpc.useUtils();
  const { data: receipt, isLoading, error } = trpc.store.getReceiptSettings.useQuery(undefined, { enabled: !!session });
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [printer, setPrinter] = useState<PrinterPrefs>(defaultPrinter);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [printerBusy, setPrinterBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(printerStorageKey);
      if (saved) setPrinter({ ...defaultPrinter, ...JSON.parse(saved) as Partial<PrinterPrefs> });
    } catch { localStorage.removeItem(printerStorageKey); }
  }, []);
  useEffect(() => {
    if (receipt) setDraft({
      showLogo: receipt.showLogo, showStoreName: receipt.showStoreName, showOutletName: receipt.showOutletName,
      showAddress: receipt.showAddress, showWhatsapp: receipt.showWhatsapp, showCashier: receipt.showCashier,
      showCustomer: receipt.showCustomer, showHeyPostWatermark: receipt.showHeyPostWatermark,
      footerMessage: receipt.footerMessage ?? "",
    });
  }, [receipt]);

  const saveReceipt = trpc.store.updateReceiptSettings.useMutation({
    onSuccess: async () => { await utils.store.getReceiptSettings.invalidate(); toast.success("Pengaturan struk disimpan"); },
    onError: (cause) => toast.error(cause.message),
  });
  const uploadLogo = trpc.store.uploadLogo.useMutation({
    onSuccess: async ({ imageUrl }) => {
      await utils.auth.me.invalidate();
      setLogoPreview(imageUrl);
      toast.success("Logo toko berhasil diperbarui");
      setLogoBusy(false);
    },
    onError: (cause) => { toast.error(cause.message); setLogoBusy(false); },
  });

  if (!session) return null;
  const activeOutlet = session.outlets.find((outlet) => outlet.id === session.activeOutletId);
  const setPrinterValue = <K extends keyof PrinterPrefs>(key: K, value: PrinterPrefs[K]) => {
    setPrinter((current) => {
      const next = { ...current, [key]: value };
      localStorage.setItem(printerStorageKey, JSON.stringify(next));
      return next;
    });
  };
  const pairPrinter = async () => {
    const bluetooth = (navigator as Navigator & { bluetooth?: { requestDevice(options: { acceptAllDevices: boolean }): Promise<{ id: string; name?: string }> } }).bluetooth;
    if (!bluetooth) { toast.error("Browser ini tidak mendukung Bluetooth. Gunakan Chrome atau Edge melalui HTTPS."); return; }
    setPrinterBusy(true);
    try {
      const device = await bluetooth.requestDevice({ acceptAllDevices: true });
      setPrinterValue("deviceId", device.id);
      setPrinterValue("deviceName", device.name || "Printer Bluetooth");
      toast.success("Perangkat dipilih. Pastikan printer mendukung koneksi dari browser.");
    } catch (cause) {
      if (cause instanceof Error && cause.name !== "NotFoundError") toast.error(cause.message);
    } finally { setPrinterBusy(false); }
  };
  const chooseLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error("Gunakan JPG, PNG, atau WebP maksimal 5 MB."); event.target.value = ""; return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setLogoPreview(reader.result);
      setLogoBusy(true);
      uploadLogo.mutate({ dataUrl: reader.result });
    };
    reader.onerror = () => toast.error("File logo tidak dapat dibaca.");
    reader.readAsDataURL(file);
  };
  const toggleFields: { key: keyof Omit<ReceiptDraft, "footerMessage">; label: string }[] = [
    { key: "showLogo", label: "Logo toko" }, { key: "showStoreName", label: "Nama toko" },
    { key: "showOutletName", label: "Nama outlet" }, { key: "showAddress", label: "Alamat outlet" },
    { key: "showWhatsapp", label: "WhatsApp outlet" }, { key: "showCashier", label: "Nama kasir" },
    { key: "showCustomer", label: "Nama pelanggan" }, { key: "showHeyPostWatermark", label: "Watermark HeyPost" },
  ];

  return <div className="page-container settings-page settings-hub settings-detail-page">
    {isHub && <header className="page-heading"><div><span className="section-kicker">PREFERENSI TOKO</span><h1>Pengaturan</h1><p>Kelola {session.store.name} dan perangkat kasir.</p></div>    {isHub ? <div className="settings-hub-group"><h2>MENU PENGATURAN</h2><div className="settings-hub-list">
      {settingsGroups.flatMap((group) => group.items).map(({ label, description, icon: Icon, to }) => {
        const content = <><span className="settings-hub-icon"><Icon size={20} /></span><span className="settings-hub-copy"><strong>{label}</strong><small>{description}</small></span>{to ? <span className="settings-hub-arrow" aria-hidden="true">›</span> : <span className="settings-hub-soon">Segera</span>}</>;
        return to ? <Link className="settings-hub-row" key={label} to={to}>{content}</Link> : <div className="settings-hub-row is-disabled" key={label} aria-disabled="true">{content}</div>;
      })}
    </div></div> : <header className="page-heading settings-subpage-heading"><div><Link className="settings-back-link" to="/pengaturan">‹ Pengaturan</Link><span className="section-kicker">{isReceipt ? "IDENTITAS TOKO" : "PERANGKAT INI"}</span><h1>{isReceipt ? "Pengaturan struk" : "Printer Bluetooth"}</h1><p>{isReceipt ? "Atur informasi yang tampil pada setiap struk." : "Kelola koneksi dan preferensi printer di perangkat ini."}</p></div></header>}
    {isReceipt && <>
    <section className="receipt-settings-section" id="receipt">
      <div className="settings-detail-heading"><div><span className="section-kicker">IDENTITAS TOKO</span><h2>Pengaturan struk</h2><p>Preferensi ini berlaku untuk semua perangkat di toko.</p></div></div>
      {isLoading ? <p className="settings-muted">Memuat pengaturan struk…</p> : error ? <p className="settings-error" role="alert">{error.message}</p> : draft && <>
        <div className="receipt-logo-editor">
          <div className="receipt-logo-preview">{logoPreview || session.store.logoUrl ? <img src={logoPreview || session.store.logoUrl || ""} alt="Logo toko" /> : <ImagePlus size={26} />}</div>
          <div><strong>Logo toko</strong><p>JPG, PNG, atau WebP. Maksimal 5 MB.</p><label className="button secondary receipt-upload-button">{logoBusy ? "Mengunggah…" : "Pilih logo"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseLogo} disabled={logoBusy} /></label></div>
        </div>
        <div className="receipt-toggle-list">{toggleFields.map(({ key, label }) => <label className="receipt-toggle-row" key={key}><span>{label}</span><input type="checkbox" checked={draft[key]} onChange={(event) => setDraft((current) => current ? { ...current, [key]: event.target.checked } : current)} /></label>)}</div>
        <label className="receipt-footer-field">Pesan footer struk<textarea rows={3} maxLength={300} value={draft.footerMessage} onChange={(event) => setDraft((current) => current ? { ...current, footerMessage: event.target.value } : current)} placeholder="Contoh: Terima kasih telah berbelanja." /><small>Maksimal 300 karakter.</small></label>
        <div className="receipt-preview"><span className="section-kicker">PRATINJAU STRUK</span><div className="receipt-preview-paper">
          {draft.showLogo && (logoPreview || session.store.logoUrl) && <img src={logoPreview || session.store.logoUrl || ""} alt="" />}
          {draft.showStoreName && <strong>{session.store.name}</strong>}
          {draft.showOutletName && <span>{activeOutlet?.name}</span>}
          {draft.showAddress && activeOutlet?.address && <span>{activeOutlet.address}</span>}
          {draft.showWhatsapp && activeOutlet?.whatsappNumber && <span>WhatsApp: {activeOutlet.whatsappNumber}</span>}
          <hr /><span>INV-20261127-0001</span><span>1 × Contoh produk</span><strong>Rp25.000</strong>
          {draft.showCashier && <span>Kasir: Nama kasir</span>}{draft.showCustomer && <span>Pelanggan: Umum</span>}
          {draft.showHeyPostWatermark && <small>Powered by HeyPost</small>}
          {draft.footerMessage && <p>{draft.footerMessage}</p>}
        </div></div>
        <div className="settings-detail-actions"><button className="button primary" type="button" onClick={() => saveReceipt.mutate({ ...draft, footerMessage: draft.footerMessage.trim() || null })} disabled={saveReceipt.isPending}>{saveReceipt.isPending ? "Menyimpan…" : "Simpan pengaturan struk"}</button></div>
      </>}
    </section>
    </>}
    {isPrinter && <>
    <section className="receipt-settings-section printer-settings-section" id="printer">
      <div className="settings-detail-heading"><div><span className="section-kicker">PERANGKAT INI</span><h2>Printer Bluetooth</h2><p>Koneksi dan preferensi printer disimpan lokal di perangkat ini.</p></div></div>
      <div className="printer-device-row"><span className="settings-hub-icon"><Bluetooth size={21} /></span><div><strong>{printer.deviceName || "Belum ada printer dipilih"}</strong><small>{printer.deviceId ? "Perangkat tersimpan di HP ini" : "Hubungkan printer thermal Bluetooth"}</small></div><button type="button" className="button secondary" onClick={pairPrinter} disabled={printerBusy}>{printerBusy ? "Mencari…" : <><Bluetooth size={16} /> Hubungkan</>}</button></div>
      {printer.deviceId && <button className="printer-forget-button" type="button" onClick={() => { setPrinterValue("deviceId", ""); setPrinterValue("deviceName", ""); toast.success("Printer dilepas dari perangkat ini"); }}>Lepas perangkat</button>}
      <div className="printer-options">
        <label>Ukuran kertas<select value={printer.paperWidth} onChange={(event) => setPrinterValue("paperWidth", event.target.value as "58" | "80")}><option value="58">58 mm</option><option value="80">80 mm</option></select></label>
        <label>Jumlah salinan<select value={printer.copies} onChange={(event) => setPrinterValue("copies", Number(event.target.value))}><option value={1}>1 salinan</option><option value={2}>2 salinan</option><option value={3}>3 salinan</option></select></label>
      </div>
      <label className="receipt-toggle-row printer-auto-row"><span><strong>Cetak otomatis</strong><small>Cetak setelah transaksi berhasil pada perangkat ini.</small></span><input type="checkbox" checked={printer.autoPrint} onChange={(event) => setPrinterValue("autoPrint", event.target.checked)} /></label>
      <p className="settings-muted"><RefreshCw size={14} /> Pengaturan printer tidak ikut berpindah saat akun login di HP lain. Pemilihan perangkat belum menjamin kompatibilitas protokol cetak; printer perlu mendukung metode cetak yang digunakan browser.</p>
      <div className="settings-muted"><Check size={15} /> Preferensi perangkat tersimpan otomatis.</div>
    </section>
    </>} </section>
  </div>;
}
