import { useMemo, useState } from "react";
import { ChevronRight, Download, Plus, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/Loading";
import { downloadCsv, formatDate, rupiah } from "@/lib/format";
import "./TransactionsPage.css";

type TransactionRow = {
  id: number; invoiceNumber: string; customerName: string | null; createdAt: Date; orderType: string;
  paymentMethod: string; total: number; items: { productName: string; quantity: number; unitPrice: number; subtotal: number }[];
};
type PaymentMethod = "Tunai" | "QRIS" | "Kartu";

const expenseCategories = ["Bahan baku", "Operasional", "Transportasi", "Gaji", "Listrik & air", "Perawatan", "Lainnya"];
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function TransactionsPage() {
  const { data, isLoading, error, refetch } = trpc.pos.transactions.useQuery();
  const { data: session } = useAuth();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState(expenseCategories[0]);
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<PaymentMethod>("Tunai");
  const utils = trpc.useUtils();
  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: async () => {
      await utils.expenses.invalidate();
      toast.success("Pengeluaran berhasil disimpan");
      setIsExpenseDialogOpen(false);
      setExpenseCategory(expenseCategories[0]);
      setExpenseDescription("");
      setExpenseAmount("");
      setExpenseDate(today());
      setExpensePaymentMethod("Tunai");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const rows = useMemo(() => (data ?? []) as TransactionRow[], [data]);
  const filtered = useMemo(() => rows.filter((row) => `${row.invoiceNumber} ${row.customerName}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);
  const todayString = new Date().toDateString();
  const todayRows = rows.filter((row) => new Date(row.createdAt).toDateString() === todayString);
  const isManager = session?.principal.role === "owner" || session?.principal.role === "manager";
  const exportData = () => {
    if (!filtered.length) { toast.error("Tidak ada transaksi untuk diekspor"); return; }
    downloadCsv("heypost-transaksi.csv", [["Invoice", "Tanggal", "Pelanggan", "Tipe pesanan", "Pembayaran", "Total"], ...filtered.map((row) => [row.invoiceNumber, formatDate(row.createdAt), row.customerName ?? "", row.orderType, row.paymentMethod, row.total])]);
    toast.success("Riwayat transaksi diekspor");
  };
  const submitExpense = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(expenseAmount);
    if (!Number.isSafeInteger(numericAmount) || numericAmount < 1) {
      toast.error("Masukkan nominal pengeluaran yang valid");
      return;
    }
    createExpense.mutate({
      category: expenseCategory,
      description: expenseDescription.trim() || undefined,
      amount: numericAmount,
      paymentMethod: expensePaymentMethod,
      expenseDate,
    });
  };

  return <div className="page-container">
    <header className="page-heading transactions-page-heading"><div><h1>Riwayat Harian</h1></div></header>
    <div className="transaction-stats"><div><span>Transaksi</span><strong>{todayRows.length}</strong></div><div><span>Penjualan hari ini</span><strong>{rupiah(todayRows.reduce((sum, row) => sum + row.total, 0))}</strong></div></div>

    <section className="transactions-list-section" aria-labelledby="transactions-list-title">
      <div className="transactions-list-heading">
        <h2 id="transactions-list-title">Transaksi hari ini</h2>
        <div className="transactions-list-actions">
          {isManager && <button className="button primary" type="button" onClick={() => setIsExpenseDialogOpen(true)}><Plus size={18} /> Pengeluaran</button>}
          <button className="button secondary" type="button" onClick={exportData} disabled={!filtered.length}><Download size={18} /> Ekspor CSV</button>
        </div>
      </div>
      <div className="list-toolbar"><label className="search-field"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari invoice atau pelanggan…" aria-label="Cari transaksi" /></label><span>{filtered.length} transaksi</span></div>
      {isLoading ? <Loading /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : filtered.length === 0 ? <div className="state-panel"><ReceiptText size={30} /><h2>Belum ada transaksi</h2><p>Transaksi yang selesai akan muncul di sini.</p></div> : <div className="transaction-table-wrap"><table className="transaction-table"><thead><tr><th>Invoice</th><th>Pelanggan</th><th>Pembayaran</th><th>Total</th><th><span className="sr-only">Detail</span></th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} onClick={() => setSelected(row)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(row); } }}><td><strong>{row.invoiceNumber}</strong><span>{formatDate(row.createdAt)}</span></td><td><strong>{row.customerName}</strong><span>{row.orderType}</span></td><td><span className="payment-badge">{row.paymentMethod}</span></td><td><strong>{rupiah(row.total)}</strong><span>{row.items.reduce((sum, item) => sum + item.quantity, 0)} item</span></td><td><button className="icon-button" onClick={(event) => { event.stopPropagation(); setSelected(row); }} aria-label={`Detail ${row.invoiceNumber}`}><ChevronRight size={19} /></button></td></tr>)}</tbody></table></div>}
    </section>

    <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
      <DialogContent className="expense-dialog">
        <DialogTitle>Catat pengeluaran</DialogTitle>
        <DialogDescription>Pengeluaran akan dicatat pada outlet yang sedang aktif.</DialogDescription>
        <form className="form-grid expense-form" onSubmit={submitExpense}>
          <label>Kategori<select value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)}>{expenseCategories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Nominal (Rp)<input type="number" min="1" max="1000000000000" step="1" inputMode="numeric" placeholder="Contoh: 150000" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} required /></label>
          <label>Tanggal pengeluaran<input type="date" value={expenseDate} max={today()} onChange={(event) => setExpenseDate(event.target.value)} required /></label>
          <label>Metode pembayaran<select value={expensePaymentMethod} onChange={(event) => setExpensePaymentMethod(event.target.value as PaymentMethod)}><option value="Tunai">Tunai</option><option value="QRIS">QRIS</option><option value="Kartu">Kartu</option></select></label>
          <label className="expense-description">Keterangan (opsional)<textarea maxLength={500} value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} placeholder="Contoh: Pembelian gas untuk dapur" /></label>
          <div className="expense-form-actions"><button type="button" className="button secondary" onClick={() => setIsExpenseDialogOpen(false)}>Batal</button><button type="submit" className="button primary" disabled={createExpense.isPending}>{createExpense.isPending ? "Menyimpan..." : "Simpan pengeluaran"}</button></div>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="detail-dialog">{selected && <><DialogTitle>Detail transaksi</DialogTitle><DialogDescription>{selected.invoiceNumber} · {formatDate(selected.createdAt)}</DialogDescription><div className="detail-customer"><span>{selected.customerName}</span><span>{selected.orderType} · {selected.paymentMethod}</span></div><div className="detail-items">{selected.items.map((item, index) => <div key={index}><span><b>{item.quantity}×</b> {item.productName}<small>{rupiah(item.unitPrice)}</small></span><strong>{rupiah(item.subtotal)}</strong></div>)}</div><div className="detail-total"><span>Total dibayar</span><strong>{rupiah(selected.total)}</strong></div><button className="button secondary full-width" onClick={() => window.print()}>Cetak bukti transaksi</button></>}</DialogContent></Dialog>
  </div>;
}
