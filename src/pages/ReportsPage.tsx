import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Download, ShoppingBag, TrendingUp, WalletCards } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { ErrorState, Loading } from "@/components/Loading";
import { downloadCsv, rupiah } from "@/lib/format";

type Range = "today" | "week" | "month" | "all";
const ranges: { value: Range; label: string }[] = [{ value: "today", label: "Hari ini" }, { value: "week", label: "7 hari" }, { value: "month", label: "30 hari" }, { value: "all", label: "Semua" }];

export default function ReportsPage() {
  const [range, setRange] = useState<Range>("week");
  const { data, isLoading, error, refetch } = trpc.pos.summary.useQuery({ range });
  const exportReport = () => {
    if (!data) return;
    downloadCsv(`heypost-laporan-${range}.csv`, [["Tanggal", "Pendapatan", "Transaksi"], ...data.daily.map((day) => [day.date, day.revenue, day.orders]), [], ["Produk terlaris", "Unit", "Pendapatan"], ...data.topProducts.map((product) => [product.name, product.quantity, product.revenue])]);
    toast.success("Laporan penjualan diekspor");
  };
  const last = data?.daily.at(-1)?.revenue ?? 0;
  const previous = data?.daily.at(-2)?.revenue ?? 0;
  const trend = previous ? Math.round(((last - previous) / previous) * 100) : 0;
  return <div className="page-container reports-page">
    <header className="page-heading"><div><span className="section-kicker">PERFORMA BISNIS</span><h1>Laporan penjualan</h1><p>Baca yang terjadi, lalu tentukan langkah berikutnya.</p></div><button className="button secondary" onClick={exportReport} disabled={!data}><Download size={18} /> Ekspor laporan</button></header>
    <div className="range-tabs" role="tablist" aria-label="Periode laporan">{ranges.map((item) => <button key={item.value} role="tab" aria-selected={range === item.value} className={range === item.value ? "active" : ""} onClick={() => setRange(item.value)}>{item.label}</button>)}</div>
    {isLoading ? <Loading label="Menghitung laporan…" /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : data && <>
      <div className="metric-grid"><div className="metric-primary"><span>Penjualan kotor</span><strong>{rupiah(data.revenue)}</strong><small className={trend >= 0 ? "trend-up" : "trend-down"}>{trend >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{Math.abs(trend)}% dibanding hari sebelumnya</small></div><div className="metric"><ShoppingBag size={20} /><span>Transaksi</span><strong>{data.orders}</strong><small>pesanan selesai</small></div><div className="metric"><TrendingUp size={20} /><span>Produk terjual</span><strong>{data.itemsSold}</strong><small>total unit</small></div><div className="metric"><WalletCards size={20} /><span>Rata-rata transaksi</span><strong>{rupiah(data.average)}</strong><small>per pesanan</small></div></div>
      <div className="report-main-grid"><section className="sales-chart"><div className="section-heading"><div><h2>Tren penjualan</h2><p>Pendapatan harian pada periode terpilih</p></div><span className="chart-legend"><i /> Penjualan</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.daily} margin={{ top: 16, right: 18, left: 0, bottom: 0 }}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0064e6" stopOpacity={0.24} /><stop offset="100%" stopColor="#0064e6" stopOpacity={0.015} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="3 5" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} interval={range === "month" ? 5 : 0} /><YAxis axisLine={false} tickLine={false} width={48} tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)} rb`} /><Tooltip formatter={(value) => [rupiah(Number(value)), "Penjualan"]} contentStyle={{ borderRadius: 10, border: "1px solid #dfe3e8", boxShadow: "0 10px 30px #102a430d", fontFamily: "Figtree Variable" }} /><Area type="monotone" dataKey="revenue" stroke="#0064e6" strokeWidth={2.5} fill="url(#salesFill)" activeDot={{ r: 5, fill: "#0064e6", stroke: "#f7f8fa", strokeWidth: 3 }} /></AreaChart></ResponsiveContainer></div></section>
      <section className="payment-summary"><div className="section-heading"><div><h2>Metode pembayaran</h2><p>Kontribusi terhadap penjualan</p></div></div><div className="payment-list">{data.payments.map((payment) => <div key={payment.method}><div><span>{payment.method}</span><strong>{rupiah(payment.total)}</strong></div><div className="payment-track"><i style={{ width: `${data.revenue ? Math.max(2, payment.total / data.revenue * 100) : 0}%` }} /></div><small>{data.revenue ? Math.round(payment.total / data.revenue * 100) : 0}% dari penjualan</small></div>)}</div></section></div>
      <section className="top-products"><div className="section-heading"><div><h2>Produk terlaris</h2><p>Berdasarkan nilai penjualan pada periode ini</p></div></div>{data.topProducts.length ? <div className="top-product-list">{data.topProducts.map((product, index) => <div key={product.name}><span className="rank">{String(index + 1).padStart(2, "0")}</span><div className="top-name"><strong>{product.name}</strong><span>{product.quantity} unit terjual</span></div><div className="top-bar"><i style={{ width: `${product.revenue / data.topProducts[0].revenue * 100}%` }} /></div><strong>{rupiah(product.revenue)}</strong></div>)}</div> : <div className="inline-empty">Belum ada produk terjual pada periode ini.</div>}</section>
    </>}
  </div>;
}
