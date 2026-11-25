import { useMemo, useState } from "react";
import { useOutletContext } from "react-router";
import { Ban, ChevronRight, Download, Plus, ReceiptText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/Loading";
import { downloadCsv, formatDate, rupiah } from "@/lib/format";
import "./TransactionsPage.css";

type TransactionRow = {
  id: number; invoiceNumber: string; customerName: string | null; createdAt: Date; orderType: string;
  paymentMethod: string; status: "Selesai" | "Dibatalkan"; subtotal: number; discount: number; total: number; items: { productId: number; productName: string; quantity: number; unitPrice: number; subtotal: number }[];
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editItems, setEditItems] = useState<{ productId: number; quantity: number }[]>([]);
  const [editDiscount, setEditDiscount] = useState("0");
  const [editCashReceived, setEditCashReceived] = useState("0");
  const canManageTransactions = session?.principal.role === "owner";
  const utils = trpc.useUtils();
  // [ADDED] Pembatalan transaksi hanya tersedia untuk owner.
  const cancelTransaction = trpc.pos.cancelTransaction.useMutation({
    onSuccess: async () => {
      await utils.pos.transactions.invalidate();
      await utils.pos.summary.invalidate();
      await utils.pos.bootstrap.invalidate();
      setSelected(null);
      toast.success("Transaksi dibatalkan dan stok dikembalikan");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState(expenseCategories[0]);
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<PaymentMethod>("Tunai");
  const canViewExpenses = session?.principal.role === "owner" || session?.principal.permissions.includes("expenses.daily.view") === true;
  const canCreateExpenses = session?.principal.role === "owner" || session?.principal.permissions.includes("expenses.daily.create") === true;
  const { data: expenseData, isLoading: expensesLoading, error: expensesError, refetch: refetchExpenses } = trpc.expenses.list.useQuery({ fromDate: today(), toDate: today() }, { enabled: !!canViewExpenses });
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
  // [ADDED] Edit transaksi hanya untuk owner; stok disesuaikan di backend.
  const updateTransaction = trpc.pos.updateTransaction.useMutation({
    onSuccess: async () => {
      await utils.pos.transactions.invalidate();
      await utils.pos.summary.invalidate();
      await utils.pos.bootstrap.invalidate();
      setIsEditDialogOpen(false);
      setSelected(null);
      toast.success("Transaksi berhasil diperbarui");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const openEditDialog = (transaction: TransactionRow) => {
    setEditItems(transaction.items.map((item) => ({ productId: item.productId, quantity: item.quantity })));
    setEditDiscount(String(transaction.discount));
    setEditCashReceived(String(transaction.cashReceived ?? transaction.total));
    setIsEditDialogOpen(true);
  };
  const saveTransactionEdit = () => {
    if (!selected || !editItems.length) { toast.error("Transaksi harus memiliki minimal satu item"); return; }
    const discount = Number(editDiscount);
    if (!Number.isSafeInteger(discount) || discount < 0) { toast.error("Diskon tidak valid"); return; }
    updateTransaction.mutate({
      id: selected.id,
      customerName: selected.customerName ?? undefined,
      orderType: selected.orderType as "Makan di tempat" | "Bawa pulang" | "Pesan antar",
      paymentMethod: selected.paymentMethod as "Tunai" | "QRIS" | "Kartu",
      discount,
      cashReceived: selected.paymentMethod === "Tunai" ? Number(editCashReceived) : undefined,
      items: editItems,
    });
  };
  const rows = useMemo(() => (data ?? []) as TransactionRow[], [data]);
  const todayString = new Date().toDateString();
  const todayRows = rows.filter((row) => new Date(row.createdAt).toDateString() === todayString);
  const expenses = useMemo(() => (expenseData ?? []) as ExpenseRow[], [expenseData]);
  const salesToday = todayRows.filter((row) => row.status === "Selesai").reduce((sum, row) => sum + row.total, 0);
  const expensesToday = canViewExpenses ? expenses.reduce((sum, row) => sum + row.amount, 0) : 0;
  const remainingToday = salesToday - expensesToday;
  const query = mobileSearchQuery.trim().toLocaleLowerCase("id-ID");
  const filteredRows = query ? todayRows.filter((row) => row.invoiceNumber.toLocaleLowerCase("id-ID").includes(query)) : todayRows;
  const ledger = [
    ...filteredRows.map((row) => ({ kind: "sale" as const, id: `sale-${row.id}`, timestamp: new Date(row.createdAt).getTime(), row })),
    ...(query || !canViewExpenses ? [] : expenses.map((row) => ({ kind: "expense" as const, id: `expense-${row.id}`, timestamp: new Date(row.createdAt).getTime(), row }))),
  ].sort((a, b) => b.timestamp - a.timestamp);
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
    <div className={`transaction-stats ${canViewExpenses ? "has-expense-stats" : ""}`}><div><span>Penjualan hari ini</span><strong>{rupiah(salesToday)}</strong></div>{canViewExpenses && <><div className="expense-stat"><span>Pengeluaran hari ini</span><strong>{rupiah(expensesToday)}</strong></div><div className={`balance-stat ${remainingToday < 0 ? "negative" : ""}`}><span>Sisa hari ini</span><strong>{rupiah(remainingToday)}</strong></div></>}</div>

    <section className="transactions-list-section" aria-labelledby="transactions-list-title">
      <div className="transactions-list-heading">
        <h2 id="transactions-list-title">Transaksi hari ini</h2>
        <div className="transactions-list-actions">
          {canCreateExpenses && <button className="button primary" type="button" onClick={() => setIsExpenseDialogOpen(true)}><Plus size={18} /> Pengeluaran</button>}
          <button className="button secondary" type="button" onClick={exportData} disabled={!rows.length}><Download size={18} /> Ekspor CSV</button>
        </div>
      </div>
      <div className="list-toolbar"><span>{ledger.length} aktivitas</span></div>
      {isLoading || (canViewExpenses && expensesLoading) ? <Loading /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : canViewExpenses && expensesError ? <ErrorState message={expensesError.message} retry={() => refetchExpenses()} /> : ledger.length === 0 ? <div className="state-panel"><ReceiptText size={30} /><h2>{mobileSearchQuery.trim() ? "Invoice tidak ditemukan" : "Belum ada aktivitas hari ini"}</h2><p>{mobileSearchQuery.trim() ? "Coba nomor invoice yang lain." : "Penjualan dan pengeluaran hari ini akan muncul di sini."}</p></div> : <div className="daily-ledger">{ledger.map((entry) => entry.kind === "sale" ? <button type="button" className="daily-ledger-row sale-row" key={entry.id} onClick={() => setSelected(entry.row)}><span className="ledger-kind">Penjualan</span><span className="ledger-main"><strong>{entry.row.invoiceNumber}</strong><small>{entry.row.customerName || entry.row.orderType} · {formatDate(entry.row.createdAt)}</small></span><span className="ledger-amount"><strong>+{rupiah(entry.row.total)}</strong><small>{entry.row.items.reduce((sum, item) => sum + item.quantity, 0)} item</small></span><ChevronRight size={18} /></button> : <div className="daily-ledger-row expense-row" key={entry.id}><span className="ledger-kind">Pengeluaran</span><span className="ledger-main"><strong>{entry.row.category}</strong><small>{entry.row.description || entry.row.paymentMethod} · {formatDate(entry.row.createdAt)}</small></span><span className="ledger-amount"><strong>−{rupiah(entry.row.amount)}</strong><small>{entry.row.paymentMethod}</small></span></div>)}</div>}
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

    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="detail-dialog">{selected && <><DialogTitle>Detail transaksi</DialogTitle><DialogDescription>{selected.invoiceNumber} · {formatDate(selected.createdAt)}</DialogDescription><div className="detail-customer"><span>{selected.customerName}</span><span>{selected.orderType} · {selected.paymentMethod}</span></div><div className="detail-items">{selected.items.map((item, index) => <div key={index}><span><b>{item.quantity}×</b> {item.productName}<small>{rupiah(item.unitPrice)}</small></span><strong>{rupiah(item.subtotal)}</strong></div>)}</div><div className="detail-total"><span>Total dibayar</span><strong>{rupiah(selected.total)}</strong></div>{canManageTransactions && selected.status === "Selesai" && <button className="button secondary full-width" type="button" onClick={() => openEditDialog(selected)}><Pencil size={16} /> Edit transaksi</button>}{canManageTransactions && selected.status === "Selesai" && <button className="button danger full-width" type="button" disabled={cancelTransaction.isPending} onClick={() => { if (window.confirm(`Batalkan transaksi ${selected.invoiceNumber}? Stok akan dikembalikan dan omzet akan disesuaikan.`)) cancelTransaction.mutate({ id: selected.id }); }}><Ban size={16} /> Batalkan transaksi</button>}{selected.status === "Dibatalkan" && <p className="cancelled-notice">Transaksi ini sudah dibatalkan. Riwayat tetap tersimpan.</p>}<button className="button secondary full-width" onClick={() => window.print()}>Cetak bukti transaksi</button></>}</DialogContent></Dialog>
    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
      <DialogContent className="expense-dialog">
        <DialogTitle>Edit transaksi</DialogTitle>
        <DialogDescription>Ubah jumlah item dan diskon. Harga mengikuti harga menu saat ini; stok disesuaikan otomatis.</DialogDescription>
        <div className="form-grid expense-form">
          {editItems.map((item) => {
            const transactionItem = selected?.items.find((current) => current.productId === item.productId);
            return <label key={item.productId}>{transactionItem?.productName ?? "Produk"}<input type="number" min="1" max="999" value={item.quantity} onChange={(event) => setEditItems((current) => current.map((entry) => entry.productId === item.productId ? { ...entry, quantity: Math.max(1, Math.min(999, Number(event.target.value) || 1)) } : entry))} /></label>;
          })}
          <label>Diskon (Rp)<input type="number" min="0" step="1" value={editDiscount} onChange={(event) => setEditDiscount(event.target.value)} /></label>
          {selected?.paymentMethod === "Tunai" && <label>Uang diterima (Rp)<input type="number" min="0" step="1" value={editCashReceived} onChange={(event) => setEditCashReceived(event.target.value)} /></label>}
          <div className="expense-form-actions"><button type="button" className="button secondary" onClick={() => setIsEditDialogOpen(false)}>Batal</button><button type="button" className="button primary" disabled={updateTransaction.isPending || !editItems.length} onClick={saveTransactionEdit}>{updateTransaction.isPending ? "Menyimpan..." : "Simpan perubahan"}</button></div>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
