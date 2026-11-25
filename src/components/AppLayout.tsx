import { useEffect } from "react";
import { ChartNoAxesColumnIncreasing, Package, ReceiptText, ShoppingBag, Store } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router";

const navigation = [
  { to: "/", label: "Kasir", icon: ShoppingBag },
  { to: "/transaksi", label: "Transaksi", icon: ReceiptText },
  { to: "/produk", label: "Produk", icon: Package },
  { to: "/laporan", label: "Laporan", icon: ChartNoAxesColumnIncreasing },
];

export default function AppLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [pathname]);
  return (
    <div className="app-shell">
      <aside className="side-nav">
        <NavLink to="/" className="wordmark" aria-label="heypost, ke kasir">hey<span>post</span><b>.</b></NavLink>
        <div className="store-switch"><Store size={18} /><div><strong>Ruang kerja</strong><span>Kasir & inventori</span></div></div>
        <nav className="desktop-menu" aria-label="Navigasi utama">
          <p>RUANG KERJA</p>
          {navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => isActive ? "active" : ""}><Icon size={19} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="sidebar-foot"><span className="sidebar-foot-mark" /><div><strong>heypost POS</strong><span>Operasional toko</span></div></div>
      </aside>
      <main className="main-workspace"><Outlet /></main>
      <nav className="bottom-nav" aria-label="Navigasi utama">
        {navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => isActive ? "active" : ""}><Icon size={21} /><span>{label}</span></NavLink>)}
      </nav>
    </div>
  );
}
