import { useMemo, useState } from "react";
import { ChevronRight, Download, ReceiptText, Search } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/Loading";
import { downloadCsv, formatDate, rupiah } from "@/lib/format";

type TransactionRow = {
  id: number; invoiceNumber: string; customerName: string | null; createdAt: Date; orderType: string;
  paymentMethod: string; total: number; items: { productName: string; quantity: number; unitPrice: number; subtotal: number }[];
};

export default function TransactionsPage() {
  const { data, isLoading, error, refetch } = trpc.pos.transactions.useQuery();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const rows = useMemo(() => (data ?? []) as TransactionRow[], [data]);
  const filtered = useMemo(() => rows.filter((row) => `${row.invoiceNumber} ${row.customerName}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);
  const today = new Date().toDateString();
  const todayRows = rows.filter((row) => new Date(row.createdAt).toDateString() === today);
  const exportData = () => {
    if (!filtered.length) { toast.error("Tidak ada transaksi untuk diekspor"); return; }
    downloadCsv("heypost-transaksi.csv", [["Invoice", "Tanggal", "Pelanggan", "Tipe pesanan", "Pembayaran", "Total"], ...filtered.map((row) => [row.invoiceNumber, formatDate(row.createdAt), row.customerName ?? "", row.orderType, row.paymentMethod, row.total])]);
    toast.success("Riwayat transaksi diekspor");
  };
  return <div className="page-container">
    <header className="page-heading"><div><span className="section-kicker">OPERASIONAL</span><h1>Riwayat Harian</h1><p>Pantau penjualan harian dan telusuri transaksi yang sudah selesai.</p></div><button className="button secondary" onClick={exportData}><Download size={18} /> Ekspor CSV</button></header>
    <div className="transaction-stats"><div><span>Hari ini</span><strong>{todayRows.length}</strong><small>transaksi</small></div><div><span>Penjualan hari ini</span><strong>{rupiah(todayRows.reduce((sum, row) => sum + row.total, 0))}</strong><small>total kotor</small></div><div><span>Rata-rata transaksi</span><strong>{rupiah(todayRows.length ? Math.round(todayRows.reduce((sum, row) => sum + row.total, 0) / todayRows.length) : 0)}</strong><small>hari ini</small></div></div>
    <div className="list-toolbar"><label className="search-field"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari invoice atau pelanggan…" aria-label="Cari transaksi" /></label><span>{filtered.length} transaksi</span></div>
    {isLoading ? <Loading /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : filtered.length === 0 ? <div className="state-panel"><ReceiptText size={30} /><h2>Belum ada transaksi</h2><p>Transaksi yang selesai akan muncul di sini.</p></div> : <div className="transaction-table-wrap"><table className="transaction-table"><thead><tr><th>Invoice</th><th>Pelanggan</th><th>Pembayaran</th><th>Total</th><th><span className="sr-only">Detail</span></th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} onClick={() => setSelected(row)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(row); } }}><td><strong>{row.invoiceNumber}</strong><span>{formatDate(row.createdAt)}</span></td><td><strong>{row.customerName}</strong><span>{row.orderType}</span></td><td><span className="payment-badge">{row.paymentMethod}</span></td><td><strong>{rupiah(row.total)}</strong><span>{row.items.reduce((sum, item) => sum + item.quantity, 0)} item</span></td><td><button className="icon-button" onClick={(event) => { event.stopPropagation(); setSelected(row); }} aria-label={`Detail ${row.invoiceNumber}`}><ChevronRight size={19} /></button></td></tr>)}</tbody></table></div>}
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="detail-dialog">{selected && <><DialogTitle>Detail transaksi</DialogTitle><DialogDescription>{selected.invoiceNumber} · {formatDate(selected.createdAt)}</DialogDescription><div className="detail-customer"><span>{selected.customerName}</span><span>{selected.orderType} · {selected.paymentMethod}</span></div><div className="detail-items">{selected.items.map((item, index) => <div key={index}><span><b>{item.quantity}×</b> {item.productName}<small>{rupiah(item.unitPrice)}</small></span><strong>{rupiah(item.subtotal)}</strong></div>)}</div><div className="detail-total"><span>Total dibayar</span><strong>{rupiah(selected.total)}</strong></div><button className="button secondary full-width" onClick={() => window.print()}>Cetak bukti transaksi</button></>}</DialogContent></Dialog>
  </div>;
}
