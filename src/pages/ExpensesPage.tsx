import { useMemo, useState } from "react";
import { Ban, Download, Plus, ReceiptText, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/Loading";
import { useAuth } from "@/hooks/useAuth";
import { downloadCsv, formatDate, rupiah } from "@/lib/format";
import { trpc } from "@/providers/trpc";
import "./ExpensesPage.css";

const categories = ["Bahan baku", "Operasional", "Transportasi", "Gaji", "Listrik & air", "Perawatan", "Lainnya"];
type PaymentMethod = "Tunai" | "QRIS" | "Kartu";
type ExpenseRow = {
  id: number; category: string; description: string | null; amount: number;
  paymentMethod: PaymentMethod; expenseDate: string; status: "Aktif" | "Dibatalkan"; createdAt: Date;
};

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function ExpensesPage() {
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // [ADDED] Menyimpan pengeluaran yang sedang dibuka pada dialog detail.
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRow | null>(null);
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Tunai");
  const [expenseDate, setExpenseDate] = useState(today);
  const { data: session } = useAuth();
  const canCancelExpenses = session?.principal.role === "owner";
  const utils = trpc.useUtils();
  const queryInput = useMemo(() => ({ fromDate, toDate }), [fromDate, toDate]);
  const { data, isLoading, error, refetch } = trpc.expenses.list.useQuery(queryInput, { enabled: fromDate <= toDate });
  const rows = (data ?? []) as ExpenseRow[];
  const activeRows = rows.filter((row) => row.status === "Aktif");
  const cancelledRows = rows.filter((row) => row.status === "Dibatalkan");
  const total = activeRows.reduce((sum, row) => sum + row.amount, 0);
  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: async () => {
      await utils.expenses.list.invalidate();
      toast.success("Pengeluaran berhasil disimpan");
      setIsDialogOpen(false);
      setDescription("");
      setAmount("");
      setCategory(categories[0]);
      setPaymentMethod("Tunai");
      setExpenseDate(today());
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const cancelExpense = trpc.expenses.cancel.useMutation({
    onSuccess: async () => {
      await utils.expenses.list.invalidate();
      setSelectedExpense((current) => current ? { ...current, status: "Dibatalkan" } : null);
      toast.success("Pengeluaran berhasil dibatalkan");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isSafeInteger(numericAmount) || numericAmount < 1) {
      toast.error("Masukkan nominal pengeluaran yang valid");
      return;
    }
    createExpense.mutate({
      category,
      description: description.trim() || undefined,
      amount: numericAmount,
      paymentMethod,
      expenseDate,
    });
  };

  const exportCsv = () => {
    if (!rows.length) {
      toast.error("Tidak ada pengeluaran untuk diekspor");
      return;
    }
    downloadCsv("heypost-pengeluaran.csv", [
      ["Tanggal", "Kategori", "Keterangan", "Metode pembayaran", "Nominal", "Status"],
      ...rows.map((row) => [row.expenseDate, row.category, row.description ?? "", row.paymentMethod, row.amount, row.status]),
    ]);
    toast.success("Data pengeluaran diekspor");
  };

  const handleCancel = (row: ExpenseRow) => {
    if (row.status !== "Aktif") return;
    if (window.confirm(`Batalkan pengeluaran ${row.category} sebesar ${rupiah(row.amount)}? Riwayat tetap tersimpan dan nominal tidak lagi dihitung sebagai pengeluaran.`)) {
      cancelExpense.mutate({ id: row.id });
    }
  };

  return <div className="page-container expenses-page">
    <header className="page-heading">
      <div><span className="section-kicker">KEUANGAN OPERASIONAL</span><h1>Pengeluaran</h1><p>Catat dan pantau biaya operasional outlet secara terpisah dari penjualan.</p></div>
      <div className="page-actions">
        <button className="button secondary" onClick={exportCsv} disabled={!rows.length}><Download size={18} /> Ekspor CSV</button>
        <button className="button primary" onClick={() => setIsDialogOpen(true)}><Plus size={18} /> Catat pengeluaran</button>
      </div>
    </header>

    <div className="expense-summary">
      <div className="expense-summary-icon"><Wallet size={21} /></div>
      <div><span>Total pengeluaran aktif pada periode ini</span><strong>{rupiah(total)}</strong><small>{activeRows.length} aktif · {cancelledRows.length} dibatalkan</small></div>
    </div>

    <section className="expense-list-section">
      <div className="expense-toolbar">
        <div><h2>Daftar pengeluaran</h2><p>Data mengikuti outlet yang sedang aktif.</p></div>
        <div className="expense-date-range">
          <label><span>Dari</span><input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label><span>Sampai</span><input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></label>
        </div>
      </div>

      {fromDate > toDate ? <div className="inline-empty">Tanggal awal tidak boleh melewati tanggal akhir.</div>
        : isLoading ? <Loading label="Memuat pengeluaran..." />
        : error ? <ErrorState message={error.message} retry={() => refetch()} />
        : rows.length === 0 ? <div className="state-panel expense-empty"><ReceiptText size={30} /><h2>Belum ada pengeluaran</h2><p>Catat biaya operasional agar arus kas outlet lebih mudah dipantau.</p><button className="button primary" onClick={() => setIsDialogOpen(true)}><Plus size={17} /> Catat pengeluaran</button></div>
        : <div className="expense-table-wrap"><table className="expense-table"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>Pembayaran</th><th>Status</th><th className="amount-cell">Nominal</th>{canCancelExpenses && <th className="expense-action-cell">Aksi</th>}</tr></thead><tbody>
          {rows.map((row) => <tr key={row.id} className={`expense-clickable-row ${row.status === "Dibatalkan" ? "expense-cancelled-row" : ""}`} onClick={() => setSelectedExpense(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedExpense(row); } }} tabIndex={0} aria-label={`Lihat detail pengeluaran ${row.category}`}><td><strong>{formatDate(new Date(`${row.expenseDate}T00:00:00`), false)}</strong></td><td><span className="expense-category">{row.category}</span></td><td>{row.description || "—"}</td><td>{row.paymentMethod}</td><td><span className={`expense-status ${row.status === "Dibatalkan" ? "is-cancelled" : "is-active"}`}>{row.status}</span></td><td className="amount-cell"><strong>{rupiah(row.amount)}</strong></td>{canCancelExpenses && <td className="expense-action-cell" onClick={(event) => event.stopPropagation()}>{row.status === "Aktif" ? <button className="expense-cancel-button" type="button" title="Batalkan pengeluaran" aria-label={`Batalkan pengeluaran ${row.category}`} disabled={cancelExpense.isPending} onClick={() => handleCancel(row)}><Ban size={16} /></button> : <span className="expense-no-action">—</span>}</td>}</tr>)}
        </tbody></table></div>}
    </section>

    {/* [ADDED] Detail pengeluaran dapat dibuka dengan menekan baris pada daftar. */}
    <Dialog open={!!selectedExpense} onOpenChange={(open) => { if (!open) setSelectedExpense(null); }}>
      <DialogContent className="expense-dialog">
        {selectedExpense && <>
          <DialogTitle>Detail pengeluaran</DialogTitle>
          <DialogDescription>{formatDate(new Date(`${selectedExpense.expenseDate}T00:00:00`), false)} · {selectedExpense.status}</DialogDescription>
          <div className="expense-detail-content">
            <div><span>Kategori</span><strong>{selectedExpense.category}</strong></div>
            <div><span>Keterangan</span><strong>{selectedExpense.description || "—"}</strong></div>
            <div><span>Metode pembayaran</span><strong>{selectedExpense.paymentMethod}</strong></div>
            <div><span>Nominal</span><strong>{rupiah(selectedExpense.amount)}</strong></div>
          </div>
          {selectedExpense.status === "Dibatalkan" && <p className="expense-detail-cancelled">Pengeluaran ini sudah dibatalkan. Riwayat tetap tersimpan.</p>}
          {canCancelExpenses && selectedExpense.status === "Aktif" && <button className="button danger full-width" type="button" disabled={cancelExpense.isPending} onClick={() => handleCancel(selectedExpense)}><Ban size={16} /> {cancelExpense.isPending ? "Membatalkan..." : "Batalkan pengeluaran"}</button>}
          <button className="button secondary full-width" type="button" onClick={() => setSelectedExpense(null)}>Tutup</button>
        </>}
      </DialogContent>
    </Dialog>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="expense-dialog">
        <DialogTitle>Catat pengeluaran</DialogTitle>
        <DialogDescription>Pengeluaran akan dicatat pada outlet yang sedang aktif.</DialogDescription>
        <form className="form-grid expense-form" onSubmit={submit}>
          <label>Kategori<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Nominal (Rp)<input type="number" min="1" step="1" inputMode="numeric" placeholder="Contoh: 150000" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <label>Tanggal pengeluaran<input type="date" value={expenseDate} max={today()} onChange={(event) => setExpenseDate(event.target.value)} required /></label>
          <label>Metode pembayaran<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}><option value="Tunai">Tunai</option><option value="QRIS">QRIS</option><option value="Kartu">Kartu</option></select></label>
          <label className="expense-description">Keterangan (opsional)<textarea maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contoh: Pembelian gas untuk dapur" /></label>
          <div className="expense-form-actions"><button type="button" className="button secondary" onClick={() => setIsDialogOpen(false)}>Batal</button><button type="submit" className="button primary" disabled={createExpense.isPending}>{createExpense.isPending ? "Menyimpan..." : "Simpan pengeluaran"}</button></div>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
