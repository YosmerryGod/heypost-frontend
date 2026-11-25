import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, ChartNoAxesColumnIncreasing, Filter, LogOut, Mail, Package, Pencil, Plus, ReceiptText, Search, ShoppingBag, Store, UserRound, UsersRound } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type PermissionKey = "pos.access" | "history.daily.view" | "menu.create" | "menu.edit" | "stock.edit" | "reports.sales.view";
const navigation: { to: string; label: string; icon: typeof ShoppingBag; roles: Role[]; permission?: PermissionKey }[] = [
  { to: "/", label: "Kasir", icon: ShoppingBag, roles: ["owner", "manager", "kasir"], permission: "pos.access" },
  { to: "/transaksi", label: "Riwayat Harian", icon: ReceiptText, roles: ["owner", "manager", "kasir"], permission: "history.daily.view" },
  { to: "/produk", label: "Produk", icon: Package, roles: ["owner", "manager", "kasir"], permission: "menu.create" }, // [MODIFIED]
  { to: "/laporan", label: "Laporan", icon: ChartNoAxesColumnIncreasing, roles: ["owner", "manager"], permission: "reports.sales.view" },
  { to: "/outlet", label: "Outlet", icon: Building2, roles: ["owner"] },
  { to: "/karyawan", label: "Karyawan", icon: UsersRound, roles: ["owner"] },
];

const bottomNavigationPaths = new Set(["/", "/transaksi"]);
const profileNavigation: { to: string; label: string; icon: typeof Package; roles: Role[]; permission?: PermissionKey }[] = [
  { to: "/produk", label: "Produk", icon: Package, roles: ["owner", "manager", "kasir"], permission: "menu.create" }, // [MODIFIED]
  { to: "/outlet", label: "Outlet", icon: Store, roles: ["owner"] },
  { to: "/karyawan", label: "Karyawan", icon: UsersRound, roles: ["owner"] },
  { to: "/laporan", label: "Laporan", icon: ChartNoAxesColumnIncreasing, roles: ["owner", "manager"], permission: "reports.sales.view" }, // [MODIFIED]
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const { data: session } = useAuth();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [mobileSearchState, setMobileSearchState] = useState({ pathname, query: "" });
  const mobileSearchQuery = mobileSearchState.pathname === pathname ? mobileSearchState.query : "";
  const setMobileSearchQuery = (query: string) => setMobileSearchState({ pathname, query });
  const isProductPage = pathname === "/produk";
  const isAdminPage = pathname === "/karyawan" || pathname === "/outlet" || isProductPage;
  const searchPlaceholder = pathname === "/" || isProductPage ? "Cari menu..." : pathname === "/transaksi" ? "Cari invoice..." : pathname === "/karyawan" ? "Cari karyawan..." : pathname === "/outlet" ? "Cari outlet..." : "Cari...";
  const closeMobileSearch = useCallback(() => {
    setIsMobileSearchOpen(false);
    setMobileSearchState({ pathname, query: "" });
  }, [pathname]);
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const [isStoreNameDialogOpen, setIsStoreNameDialogOpen] = useState(false);
  const [storeNameDraft, setStoreNameDraft] = useState("");
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileProfileRef = useRef<HTMLDivElement>(null);
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
      void utils.expenses.invalidate();
      toast.success(`Berpindah ke ${outlet?.name ?? "outlet"}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const updateStoreProfile = trpc.store.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setIsStoreNameDialogOpen(false);
      toast.success("Nama toko berhasil diperbarui");
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
  useEffect(() => {
    if (!isMobileSearchOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileSearchRef.current?.contains(event.target as Node)) closeMobileSearch();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileSearch();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileSearchOpen, closeMobileSearch]);
  useEffect(() => {
    if (isMobileSearchOpen) mobileSearchInputRef.current?.focus();
  }, [isMobileSearchOpen]);
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
  const hasPermission = (permission: PermissionKey) => principal.role === "owner" || principal.permissions.includes(permission);
  const items = navigation.filter((item) => item.roles.includes(principal.role) && (item.to === "/produk" ? hasPermission("menu.create") || hasPermission("menu.edit") || hasPermission("stock.edit") : !item.permission || hasPermission(item.permission)));
  const profileItems = profileNavigation.filter((item) => item.roles.includes(principal.role) && (item.to === "/produk" ? hasPermission("menu.create") || hasPermission("menu.edit") || hasPermission("stock.edit") : !item.permission || hasPermission(item.permission))); // [MODIFIED]
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
    <header className={`mobile-workspace-bar ${isMobileSearchOpen ? "search-open" : ""} ${isAdminPage ? "admin-workspace-bar" : ""}`}>
      {isProductPage ? <div className="mobile-admin-brand product-mobile-brand"><button className="icon-button mobile-back-trigger" type="button" onClick={() => navigate(-1)} aria-label="Kembali"><ArrowLeft size={20} /></button><strong className="mobile-menu-title">Menu</strong></div> : isAdminPage ? <div className="mobile-admin-brand"><button className="icon-button mobile-back-trigger" type="button" onClick={() => navigate(-1)} aria-label="Kembali"><ArrowLeft size={20} /></button><NavLink to="/" className="mobile-wordmark" aria-label="heypost, ke kasir">hey<span>post</span><b>.</b></NavLink></div> : <NavLink to="/" className="mobile-wordmark" aria-label="heypost, ke kasir">hey<span>post</span><b>.</b></NavLink>}
      <div className="mobile-header-actions">
        <div className={`mobile-header-search ${isMobileSearchOpen ? "is-open" : ""}`} ref={mobileSearchRef}>
          {isMobileSearchOpen ? <div className="mobile-search-field"><Search size={18} aria-hidden="true" /><input ref={mobileSearchInputRef} type="search" value={mobileSearchQuery} onChange={(event) => setMobileSearchQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /></div> : <button className="icon-button mobile-search-trigger" type="button" onClick={() => { setIsMobileSearchOpen(true); }} aria-label="Buka pencarian" aria-expanded={false}><Search size={19} /></button>}
        </div>
        {isAdminPage && !isProductPage && <button className="icon-button mobile-admin-filter" type="button" onClick={() => window.dispatchEvent(new CustomEvent("heypost:admin-filter", { detail: pathname }))} aria-label="Filter"><Filter size={19} /></button>}{isAdminPage && <button className="icon-button mobile-admin-add" type="button" onClick={() => window.dispatchEvent(new CustomEvent("heypost:admin-add", { detail: pathname }))} aria-label="Tambah"><Plus size={21} /></button>}
        {pathname === "/" && <button className="icon-button mobile-cart-trigger" type="button" onClick={() => mobileCartOpenRef.current?.()} aria-label={`Buka detail pesanan, ${mobileCartCount} item`} title="Detail pesanan"><ShoppingBag size={19} />{mobileCartCount > 0 && <span className="mobile-cart-count">{mobileCartCount > 99 ? "99+" : mobileCartCount}</span>}</button>}
        {!isAdminPage && <div className="mobile-profile-menu" ref={mobileProfileRef}>
          <button className="icon-button mobile-profile-trigger" type="button" onClick={() => setIsMobileProfileOpen((open) => !open)} aria-expanded={isMobileProfileOpen} aria-label="Buka profil"><UserRound size={19} /></button>
          {isMobileProfileOpen && <div className="mobile-profile-popover">
            <div className="mobile-profile-section-label">AKUN</div>
            <div className="mobile-profile-identity">
              <div className="mobile-profile-avatar"><UserRound size={21} /></div>
              <div className="mobile-profile-account"><strong>{principal.name}</strong><span>{principal.role === "owner" ? "Owner" : principal.role === "manager" ? "Manager" : "Kasir"}</span></div>
            </div>
            <div className="mobile-profile-email"><Mail size={15} /><span>{principal.email || "Email tidak tersedia"}</span></div>
            <div className="mobile-profile-divider" />
            <div className="mobile-profile-section-heading"><span>TOKO</span>{principal.role === "owner" && <button type="button" onClick={() => { setStoreNameDraft(store.name); setIsStoreNameDialogOpen(true); }} aria-label="Edit nama toko"><Pencil size={15} /></button>}</div>
            <div className="mobile-profile-store-name"><Store size={18} /><strong>{store.name}</strong></div>
            <div className="mobile-profile-section-heading"><span>OUTLET</span><span className="mobile-profile-current-label">SAAT INI</span></div>
            <div className="mobile-profile-outlet">{outletControl}</div>
            {principal.role === "owner" && <button className="mobile-profile-add-outlet" type="button" onClick={() => { setIsMobileProfileOpen(false); navigate("/outlet"); }}><Plus size={17} /><span>Tambah outlet</span></button>}
            {profileItems.length > 0 && <div className="mobile-profile-menu-group">
              <div className="mobile-profile-section-heading"><span>MENU</span></div>
              <nav className="mobile-profile-links" aria-label="Menu manajemen">{profileItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setIsMobileProfileOpen(false)} className={({ isActive }) => isActive ? "active" : ""}><Icon size={18} /><span>{label}</span><span className="mobile-profile-link-arrow">›</span></NavLink>)}</nav>
            </div>}
            <button className="mobile-profile-logout" type="button" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={17} /><span>Keluar</span></button>
          </div>}
        </div>}
      </div>
      <Dialog open={isStoreNameDialogOpen} onOpenChange={setIsStoreNameDialogOpen}>
        <DialogContent className="settings-dialog">
          <DialogTitle>Edit nama toko</DialogTitle>
          <DialogDescription>Nama ini akan digunakan sebagai identitas toko di HeyPost.</DialogDescription>
          <form className="mobile-store-name-form" onSubmit={(event) => { event.preventDefault(); updateStoreProfile.mutate({ name: storeNameDraft.trim() }); }}>
            <label htmlFor="mobile-store-name">Nama toko</label>
            <input id="mobile-store-name" value={storeNameDraft} onChange={(event) => setStoreNameDraft(event.target.value)} minLength={2} maxLength={120} required autoFocus />
            <div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setIsStoreNameDialogOpen(false)}>Batal</button><button type="submit" className="button primary" disabled={updateStoreProfile.isPending || storeNameDraft.trim().length < 2}>{updateStoreProfile.isPending ? "Menyimpan..." : "Simpan perubahan"}</button></div>
          </form>
        </DialogContent>
      </Dialog>
    </header>
    <main className="main-workspace"><div key={activeOutletId}><Outlet context={{ registerMobileCart, mobileSearchQuery }} /></div></main>
    <nav className={`bottom-nav ${isAdminPage ? "admin-bottom-nav-hidden" : ""} ${isProductPage ? "products-bottom-nav-hidden" : ""}`} aria-label="Navigasi utama" style={{ gridTemplateColumns: `repeat(${bottomItems.length}, minmax(0, 1fr))` }}>
      {bottomItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => isActive ? "active" : ""} aria-label={label} title={label}>{({ isActive }) => <><Icon size={21} />{isActive && <span>{label}</span>}</>}</NavLink>)}
    </nav>
  </div>;
}
