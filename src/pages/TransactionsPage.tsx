import { useMemo, useState } from "react";
import { useOutletContext } from "react-router";
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
type ExpenseRow = { id: number; category: string; description: string | null; amount: number; paymentMethod: string; expenseDate: string; createdAt: Date };

const expenseCategories = ["Bahan baku", "Operasional", "Transportasi", "Gaji", "Listrik & air", "Perawatan", "Lainnya"];
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function TransactionsPage() {
  const { mobileSearchQuery } = useOutletContext<{ mobileSearchQuery: string }>();
  const { data, isLoading, error, refetch } = trpc.pos.transactions.useQuery();
  const { data: session } = useAuth();
  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState(expenseCategories[0]);
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<PaymentMethod>("Tunai");
  const isManager = session?.principal.role === "owner" || session?.principal.role === "manager";
  const { data: expenseData, isLoading: expensesLoading, error: expensesError, refetch: refetchExpenses } = trpc.expenses.list.useQuery({ fromDate: today(), toDate: today() }, { enabled: !!isManager });
  const utils = trpc.useUtils();
  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: async () => {
      await utils.expenses.invalidate();
      await refetchExpenses();
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
  const todayString = new Date().toDateString();
  const todayRows = rows.filter((row) => new Date(row.createdAt).toDateString() === todayString);
  const expenses = useMemo(() => (expenseData ?? []) as ExpenseRow[], [expenseData]);
  const salesToday = todayRows.reduce((sum, row) => sum + row.total, 0);
  const expensesToday = expenses.reduce((sum, row) => sum + row.amount, 0);
  const remainingToday = salesToday - expensesToday;
  const filteredRows = useMemo(() => {
    const query = mobileSearchQuery.trim().toLocaleLowerCase("id-ID");
    return query ? todayRows.filter((row) => row.invoiceNumber.toLocaleLowerCase("id-ID").includes(query)) : todayRows;
  }, [todayRows, mobileSearchQuery]);
  const ledger = useMemo(() => {
    const sales = filteredRows.map((row) => ({ kind: "sale" as const, id: `sale-${row.id}`, timestamp: new Date(row.createdAt).getTime(), row }));
    const expenseItems = mobileSearchQuery.trim() ? [] : expenses.map((row) => ({ kind: "expense" as const, id: `expense-${row.id}`, timestamp: new Date(row.createdAt).getTime(), row }));
    return [...sales, ...expenseItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredRows, expenses, mobileSearchQuery]);
  const exportData = () => {
    if (!rows.length) { toast.error("Tidak ada transaksi untuk diekspor"); return; }
    downloadCsv("heypost-transaksi.csv", [["Invoice", "Tanggal", "Pelanggan", "Tipe pesanan", "Pembayaran", "Total"], ...rows.map((row) => [row.invoiceNumber, formatDate(row.createdAt), row.customerName ?? "", row.orderType, row.paymentMethod, row.total])]);
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
    <div className={`transaction-stats ${isManager ? "has-expense-stats" : ""}`}><div><span>Penjualan hari ini</span><strong>{rupiah(salesToday)}</strong></div>{isManager && <><div className="expense-stat"><span>Pengeluaran hari ini</span><strong>{rupiah(expensesToday)}</strong></div><div className={`balance-stat ${remainingToday < 0 ? "negative" : ""}`}><span>Sisa hari ini</span><strong>{rupiah(remainingToday)}</strong></div></>}</div>

    <section className="transactions-list-section" aria-labelledby="transactions-list-title">
      <div className="transactions-list-heading">
        <h2 id="transactions-list-title">Transaksi hari ini</h2>
        <div className="transactions-list-actions">
          {isManager && <button className="button primary" type="button" onClick={() => setIsExpenseDialogOpen(true)}><Plus size={18} /> Pengeluaran</button>}
          <button className="button secondary" type="button" onClick={exportData} disabled={!rows.length}><Download size={18} /> Ekspor CSV</button>
        </div>
      </div>
      <div className="list-toolbar"><span>{ledger.length} aktivitas</span></div>
      {isLoading || (isManager && expensesLoading) ? <Loading /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : expensesError ? <ErrorState message={expensesError.message} retry={() => refetchExpenses()} /> : ledger.length === 0 ? <div className="state-panel"><ReceiptText size={30} /><h2>{mobileSearchQuery.trim() ? "Invoice tidak ditemukan" : "Belum ada aktivitas hari ini"}</h2><p>{mobileSearchQuery.trim() ? "Coba nomor invoice yang lain." : "Penjualan dan pengeluaran hari ini akan muncul di sini."}</p></div> : <div className="daily-ledger">{ledger.map((entry) => entry.kind === "sale" ? <button type="button" className="daily-ledger-row sale-row" key={entry.id} onClick={() => setSelected(entry.row)}><span className="ledger-kind">Penjualan</span><span className="ledger-main"><strong>{entry.row.invoiceNumber}</strong><small>{entry.row.customerName || entry.row.orderType} · {formatDate(entry.row.createdAt)}</small></span><span className="ledger-amount"><strong>+{rupiah(entry.row.total)}</strong><small>{entry.row.items.reduce((sum, item) => sum + item.quantity, 0)} item</small></span><ChevronRight size={18} /></button> : <div className="daily-ledger-row expense-row" key={entry.id}><span className="ledger-kind">Pengeluaran</span><span className="ledger-main"><strong>{entry.row.category}</strong><small>{entry.row.description || entry.row.paymentMethod} · {formatDate(entry.row.createdAt)}</small></span><span className="ledger-amount"><strong>−{rupiah(entry.row.amount)}</strong><small>{entry.row.paymentMethod}</small></span></div>)}</div>}
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
