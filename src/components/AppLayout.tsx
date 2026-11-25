import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChartNoAxesColumnIncreasing, LogOut, Package, ReceiptText, Settings2, ShoppingBag, Store, UserRound } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/hooks/useAuth";

const navigation: { to: string; label: string; icon: typeof ShoppingBag; roles: Role[] }[] = [
  { to: "/", label: "Kasir", icon: ShoppingBag, roles: ["owner", "manager", "kasir"] },
  { to: "/transaksi", label: "Transaksi", icon: ReceiptText, roles: ["owner", "manager", "kasir"] },
  { to: "/produk", label: "Produk", icon: Package, roles: ["owner", "manager"] },
  { to: "/laporan", label: "Laporan", icon: ChartNoAxesColumnIncreasing, roles: ["owner", "manager"] },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings2, roles: ["owner"] },
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const { data: session } = useAuth();
  const switchOutlet = trpc.store.switchOutlet.useMutation({
    onSuccess: ({ activeOutletId }, variables) => {
      utils.auth.me.setData(undefined, (current) => current ? { ...current, activeOutletId } : current);
      const outlet = session?.outlets.find((item) => item.id === variables.outletId);
      void utils.pos.invalidate();
      toast.success(`Berpindah ke ${outlet?.name ?? "outlet"}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      queryClient.clear();
      utils.auth.me.setData(undefined, null);
      navigate("/login", { replace: true });
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [pathname]);
  if (!session) return null;
  const { principal, store, outlets, activeOutletId } = session;
  const activeOutlet = outlets.find((outlet) => outlet.id === activeOutletId);
  const items = navigation.filter((item) => item.roles.includes(principal.role));
  const outletControl = principal.role === "owner" ? <select aria-label="Pilih outlet aktif" value={activeOutletId} disabled={switchOutlet.isPending} onChange={(event) => switchOutlet.mutate({ outletId: Number(event.target.value) })}>{outlets.filter((outlet) => outlet.active).map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select> : <span>{activeOutlet?.name ?? "Outlet aktif"}</span>;

  return <div className="app-shell">
    <aside className="side-nav">
      <NavLink to="/" className="wordmark" aria-label="heypost, ke kasir">hey<span>post</span><b>.</b></NavLink>
      <div className="store-switch"><Store size={18} /><div><strong>{store.name}</strong>{outletControl}</div></div>
      <nav className="desktop-menu" aria-label="Navigasi utama">
        <p>RUANG KERJA</p>
        {items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => isActive ? "active" : ""}><Icon size={19} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="sidebar-foot"><UserRound size={18} /><div><strong>{principal.name}</strong><span>{principal.role === "owner" ? "Owner" : principal.role === "manager" ? "Manager" : "Kasir"}</span></div><button className="icon-button" onClick={() => logout.mutate()} disabled={logout.isPending} aria-label="Keluar dari akun"><LogOut size={17} /></button></div>
    </aside>
    <header className="mobile-workspace-bar">
      <NavLink to="/" className="mobile-wordmark" aria-label="heypost, ke kasir">hey<span>post</span><b>.</b></NavLink>
      <div className="mobile-outlet"><strong>{store.name}</strong>{outletControl}</div>
      <button className="icon-button" onClick={() => logout.mutate()} disabled={logout.isPending} aria-label="Keluar dari akun"><LogOut size={19} /></button>
    </header>
    <main className="main-workspace"><div key={activeOutletId}><Outlet /></div></main>
    <nav className="bottom-nav" aria-label="Navigasi utama" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => isActive ? "active" : ""} aria-label={label} title={label}>{({ isActive }) => <><Icon size={21} />{isActive && <span>{label}</span>}</>}</NavLink>)}
    </nav>
  </div>;
}
