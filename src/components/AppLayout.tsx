import { useCallback, useEffect, useRef, useState } from "react"; // [MODIFIED]
import { useQueryClient } from "@tanstack/react-query";
import { ChartNoAxesColumnIncreasing, LogOut, Package, ReceiptText, Search, Settings2, ShoppingBag, Store, UserRound } from "lucide-react"; // [MODIFIED]
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/hooks/useAuth";

const navigation: { to: string; label: string; icon: typeof ShoppingBag; roles: Role[] }[] = [
  { to: "/", label: "Kasir", icon: ShoppingBag, roles: ["owner", "manager", "kasir"] },
  { to: "/transaksi", label: "Riwayat Harian", icon: ReceiptText, roles: ["owner", "manager", "kasir"] },
  { to: "/produk", label: "Produk", icon: Package, roles: ["owner", "manager"] },
  { to: "/laporan", label: "Laporan", icon: ChartNoAxesColumnIncreasing, roles: ["owner", "manager"] },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings2, roles: ["owner"] },
];

// [ADDED] Only the two most-used destinations remain in the mobile bottom navigation.
const bottomNavigationPaths = new Set(["/", "/transaksi"]);

export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const { data: session } = useAuth();
  // [ADDED] Mobile-only header interaction state and outside-click references.
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileProfileRef = useRef<HTMLDivElement>(null);
  // [ADDED] Cart state is registered by the cashier route and surfaced in the mobile header.
  const [mobileCartCount, setMobileCartCount] = useState(0);
  const mobileCartOpenRef = useRef<(() => void) | null>(null);
  const registerMobileCart = useCallback((count: number, openCart: (() => void) | null) => {
    setMobileCartCount(count);
    mobileCartOpenRef.current = openCart;
  }, []);
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

  // [ADDED] Close mobile search when the user clicks or taps outside the input.
  useEffect(() => {
    if (!isMobileSearchOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileSearchRef.current?.contains(event.target as Node)) setIsMobileSearchOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileSearchOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileSearchOpen]);

  // [ADDED] Focus the search field as soon as its expanded state is rendered.
  useEffect(() => {
    if (isMobileSearchOpen) mobileSearchInputRef.current?.focus();
  }, [isMobileSearchOpen]);

  // [ADDED] Dismiss the mobile profile menu when interaction moves outside it.
  useEffect(() => {
    if (!isMobileProfileOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileProfileRef.current?.contains(event.target as Node)) setIsMobileProfileOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isMobileProfileOpen]);
  if (!session) return null;
  const { principal, store, outlets, activeOutletId } = session;
  const activeOutlet = outlets.find((outlet) => outlet.id === activeOutletId);
  const items = navigation.filter((item) => item.roles.includes(principal.role));
  // [ADDED] Secondary destinations are available from the profile menu instead of the bottom bar.
  const profileItems = items.filter((item) => !bottomNavigationPaths.has(item.to));
  const bottomItems = items.filter((item) => bottomNavigationPaths.has(item.to));
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
    {/* [MODIFIED] Mobile header keeps search, order details, and profile aligned on the right. */}
    <header className="mobile-workspace-bar">
      <NavLink to="/" className="mobile-wordmark" aria-label="heypost, ke kasir">hey<span>post</span><b>.</b></NavLink>
      <div className="mobile-header-actions">
        <div className={`mobile-header-search ${isMobileSearchOpen ? "is-open" : ""}`} ref={mobileSearchRef}>
          {isMobileSearchOpen ? (
            <div className="mobile-search-field">
              <Search size={18} aria-hidden="true" />
              <input ref={mobileSearchInputRef} type="search" placeholder="Cari..." aria-label="Cari di HeyPost" />
            </div>
          ) : (
            <button className="icon-button mobile-search-trigger" type="button" onClick={() => setIsMobileSearchOpen(true)} aria-label="Buka pencarian" aria-expanded={false}>
              <Search size={19} />
            </button>
          )}
        </div>
        {pathname === "/" && (
          <button className="icon-button mobile-cart-trigger" type="button" onClick={() => mobileCartOpenRef.current?.()} aria-label={`Buka detail pesanan, ${mobileCartCount} item`} title="Detail pesanan">
            <ShoppingBag size={19} />
            {mobileCartCount > 0 && <span className="mobile-cart-count">{mobileCartCount > 99 ? "99+" : mobileCartCount}</span>}
          </button>
        )}
        <div className="mobile-profile-menu" ref={mobileProfileRef}>
          <button className="icon-button mobile-profile-trigger" type="button" onClick={() => setIsMobileProfileOpen((open) => !open)} aria-expanded={isMobileProfileOpen} aria-label="Buka profil">
            <UserRound size={19} />
          </button>
          {isMobileProfileOpen && (
            <div className="mobile-profile-popover">
              <div className="mobile-profile-identity">
                <strong>{principal.name}</strong>
                <span>{principal.role === "owner" ? "Owner" : principal.role === "manager" ? "Manager" : "Kasir"}</span>
              </div>
              <div className="mobile-profile-outlet">
                <strong>{store.name}</strong>
                {outletControl}
              </div>
              {/* [ADDED] Secondary app pages are grouped inside the profile menu. */}
              {profileItems.length > 0 && <nav className="mobile-profile-links" aria-label="Menu lainnya">
                {profileItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setIsMobileProfileOpen(false)} className={({ isActive }) => isActive ? "active" : ""}>
                  <Icon size={17} />
                  <span>{label}</span>
                </NavLink>)}
              </nav>}
              <button className="mobile-profile-logout" type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
                <LogOut size={17} />
                <span>Keluar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
    <main className="main-workspace"><div key={activeOutletId}><Outlet context={{ registerMobileCart }} /></div></main>
    <nav className="bottom-nav" aria-label="Navigasi utama" style={{ gridTemplateColumns: `repeat(${bottomItems.length}, minmax(0, 1fr))` }}>
      {bottomItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => isActive ? "active" : ""} aria-label={label} title={label}>{({ isActive }) => <><Icon size={21} />{isActive && <span>{label}</span>}</>}</NavLink>)}
    </nav>
  </div>;
}
