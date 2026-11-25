import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheckBig,
  CreditCard,
  Minus,
  PackageOpen,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/Loading";
import { formatDate, rupiah } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import "./PosPage.css";

type ProductView = { id: number; categoryId: number; name: string; price: number; stock: number; imageUrl: string; sku: string };
type Cart = Record<number, number>;
type CartLine = ProductView & { quantity: number };
type OrderType = "Makan di tempat" | "Bawa pulang" | "Pesan antar";
type PaymentMethod = "Tunai" | "Kartu";
type Sale = {
  invoiceNumber: string; createdAt: Date; customerName: string | null; orderType: OrderType;
  paymentMethod: PaymentMethod; subtotal: number; discount: number; total: number; cashReceived: number | null;
  items: { productName: string; unitPrice: number; quantity: number; subtotal: number }[];
};

const MAX_QUANTITY = 999;
const MAX_MONEY_INPUT = 1_000_000_000_000;

function moneyFromInput(value: string, maximum = MAX_MONEY_INPUT) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) ? Math.min(parsed, maximum) : maximum;
}

function formattedMoneyInput(value: number) {
  return value ? value.toLocaleString("id-ID") : "";
}

function quickCashValues(total: number) {
  return [...new Set([
    total,
    Math.ceil(total / 10_000) * 10_000,
    Math.ceil(total / 50_000) * 50_000,
    Math.ceil(total / 100_000) * 100_000,
  ])].filter((value) => value >= total).slice(0, 4);
}

function ProductImage({ src, name, className = "" }: { src: string; name: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return <div className={`cashier-image-fallback ${className}`} aria-hidden="true"><PackageOpen size={26} strokeWidth={1.6} /><span>{name.slice(0, 1).toUpperCase()}</span></div>;
  }
  return <img className={className} src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} />;
}

export default function PosPage() {
  const { data, isLoading, error, refetch } = trpc.pos.bootstrap.useQuery();
  const { data: session } = useAuth();
  const [category, setCategory] = useState(0);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [orderType, setOrderType] = useState<OrderType>("Makan di tempat");
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSession, setPaymentSession] = useState(0);
  const [clearOpen, setClearOpen] = useState(false);
  const [completed, setCompleted] = useState<Sale | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const products = useMemo(() => (data?.products ?? []) as ProductView[], [data]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return products.filter((product) =>
      (category === 0 || product.categoryId === category)
      && (!query || `${product.name} ${product.sku}`.toLocaleLowerCase("id-ID").includes(query)),
    );
  }, [products, category, search]);
  const lines = useMemo(
    () => products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] })),
    [products, cart],
  );
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const appliedDiscount = Math.min(discount, subtotal);
  const total = Math.max(0, subtotal - appliedDiscount);
  const stockConflict = lines.find((line) => line.quantity > line.stock);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !isEditing && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector("[data-slot='dialog-content']")) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const add = (product: ProductView) => {
    const quantity = cart[product.id] ?? 0;
    const limit = Math.min(product.stock, MAX_QUANTITY);
    if (quantity >= limit) {
      toast.error(product.stock === 0 ? `Stok ${product.name} habis` : `Maksimal ${limit} untuk ${product.name}`);
      return;
    }
    setCart((current) => ({ ...current, [product.id]: Math.min((current[product.id] ?? 0) + 1, limit) }));
    setAnnouncement(`${product.name} ditambahkan. Jumlah ${quantity + 1}.`);
  };

  const changeQuantity = (id: number, delta: number) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const limit = Math.min(product.stock, MAX_QUANTITY);
    if (delta > 0 && (cart[id] ?? 0) >= limit) {
      toast.error(`Stok ${product.name} hanya ${product.stock}`);
      return;
    }
    setCart((current) => {
      const next = Math.max(0, Math.min(limit, (current[id] ?? 0) + delta));
      const updated = { ...current, [id]: next };
      if (!next) delete updated[id];
      return updated;
    });
  };

  const openPayment = () => {
    if (!lines.length || stockConflict) return;
    setCartOpen(false);
    setPaymentSession((current) => current + 1);
    setPaymentOpen(true);
  };
  const clearCart = () => {
    setCart({});
    setDiscount(0);
    setClearOpen(false);
    setAnnouncement("Semua produk dihapus dari pesanan.");
    toast.success("Pesanan dikosongkan");
  };

  const cartPanel = <CartPanel
    lines={lines}
    itemCount={itemCount}
    orderType={orderType}
    setOrderType={setOrderType}
    customer={customer}
    setCustomer={setCustomer}
    discount={appliedDiscount}
    setDiscount={(value) => setDiscount(moneyFromInput(value, subtotal))}
    subtotal={subtotal}
    total={total}
    stockConflict={stockConflict}
    changeQuantity={changeQuantity}
    requestClear={() => setClearOpen(true)}
    checkout={openPayment}
  />;

  return <div className="cashier-page">
    <span className="sr-only" aria-live="polite">{announcement}</span>
    <section className="cashier-catalog" aria-label="Katalog produk">
      <header className="cashier-heading">
        <div>
          <span className="cashier-eyebrow">Kasir / Transaksi baru</span>
          <h1>Pilih produk</h1>
          <p><CalendarDays size={15} aria-hidden="true" />{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
        </div>
        <button className="cashier-mobile-cart-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Buka pesanan, ${itemCount} item`}>
          <ShoppingBag size={22} />{itemCount > 0 && <b>{itemCount > 99 ? "99+" : itemCount}</b>}
        </button>
      </header>

      <div className="cashier-controls">
        <div className="cashier-search-row">
          <label className="cashier-search">
            <Search size={20} aria-hidden="true" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Escape") { setSearch(""); event.currentTarget.blur(); } }}
              placeholder="Cari nama produk atau SKU…"
              aria-label="Cari nama produk atau SKU"
              autoComplete="off"
            />
            {search ? <button type="button" onClick={() => { setSearch(""); searchInputRef.current?.focus(); }} aria-label="Hapus pencarian"><X size={18} /></button> : <kbd>/</kbd>}
          </label>
          <span className="cashier-result-count" aria-live="polite">{filtered.length} produk</span>
        </div>
        <div className="cashier-categories" role="group" aria-label="Filter kategori produk">
          <button type="button" aria-pressed={category === 0} className={category === 0 ? "active" : ""} onClick={() => setCategory(0)}>Semua</button>
          {data?.categories.map((item) => <button type="button" key={item.id} aria-pressed={category === item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{item.name}</button>)}
        </div>
      </div>

      {isLoading ? <Loading label="Memuat katalog…" /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : filtered.length === 0 ? <div className="state-panel cashier-empty-state">
        {products.length === 0 ? <PackageOpen size={30} /> : <Search size={30} />}
        <h2>{products.length === 0 ? "Belum ada produk aktif" : "Produk tidak ditemukan"}</h2>
        <p>{products.length === 0 ? "Owner atau manager perlu menambahkan produk sebelum transaksi dimulai." : "Periksa ejaan, SKU, atau pilih kategori lain."}</p>
        {products.length > 0 && <button className="button secondary" type="button" onClick={() => { setSearch(""); setCategory(0); }}>Atur ulang filter</button>}
      </div> : <div className="cashier-product-grid">
        {filtered.map((product) => {
          const quantity = cart[product.id] ?? 0;
          return <button
            className={`cashier-product ${quantity ? "in-cart" : ""}`}
            key={product.id}
            type="button"
            onClick={() => add(product)}
            disabled={product.stock === 0}
            aria-label={`${product.name}, ${rupiah(product.price)}, stok ${product.stock}. ${quantity ? `${quantity} dalam pesanan` : "Tambah ke pesanan"}`}
          >
            <div className="cashier-product-image">
              <ProductImage src={product.imageUrl} name={product.name} />
              {product.stock === 0 ? <span className="cashier-stock-flag sold-out">Stok habis</span> : product.stock <= 8 ? <span className="cashier-stock-flag">Sisa {product.stock}</span> : null}
              {quantity > 0 && <span className="cashier-product-quantity" aria-hidden="true">{quantity}</span>}
              {product.stock > 0 && <span className="cashier-add-product" aria-hidden="true"><Plus size={19} /></span>}
            </div>
            <div className="cashier-product-copy">
              <h2>{product.name}</h2>
              <strong>{rupiah(product.price)}</strong>
              <p><span className={product.stock <= 8 ? "low" : ""}>{product.stock === 0 ? "Tidak tersedia" : `Stok ${product.stock}`}</span><span>{product.sku}</span></p>
            </div>
          </button>;
        })}
      </div>}
    </section>

    <aside className="cashier-order cashier-order-desktop" aria-label="Pesanan saat ini">{cartPanel}</aside>
    {itemCount > 0 && <button className="cashier-mobile-summary" type="button" onClick={() => setCartOpen(true)}>
      <span><ShoppingBag size={20} /><span><b>{itemCount} item</b><small>Lihat pesanan</small></span></span>
      <strong>{rupiah(total)}</strong><ChevronRight size={20} />
    </button>}

    <Dialog open={cartOpen} onOpenChange={setCartOpen}>
      <DialogContent className="cashier-cart-dialog" showCloseButton={false}>
        <DialogTitle className="sr-only">Pesanan saat ini</DialogTitle>
        <DialogDescription className="sr-only">Periksa dan ubah pesanan pelanggan</DialogDescription>
        <button className="cashier-cart-close" type="button" onClick={() => setCartOpen(false)} aria-label="Tutup pesanan"><X size={21} /></button>
        {cartPanel}
      </DialogContent>
    </Dialog>

    <PaymentDialog
      key={paymentSession}
      open={paymentOpen}
      onOpenChange={setPaymentOpen}
      total={total}
      subtotal={subtotal}
      discount={appliedDiscount}
      customer={customer}
      orderType={orderType}
      lines={lines}
      onCompleted={(sale) => {
        setPaymentOpen(false);
        setCompleted(sale);
        setCart({});
        setDiscount(0);
        setCustomer("");
        setAnnouncement(`Pembayaran ${sale.invoiceNumber} berhasil.`);
      }}
      invalidate={() => { void refetch(); }}
    />
    <ReceiptDialog
      sale={completed}
      storeLabel={session ? `${session.store.name} — ${session.outlets.find((outlet) => outlet.id === session.activeOutletId)?.name ?? "Outlet aktif"}` : "HeyPost"}
      onClose={() => { setCompleted(null); setPaymentOpen(false); }}
    />
    <Dialog open={clearOpen} onOpenChange={setClearOpen}>
      <DialogContent className="cashier-confirm-dialog">
        <DialogTitle>Kosongkan pesanan?</DialogTitle>
        <DialogDescription>Semua produk dan diskon pada pesanan ini akan dihapus. Tindakan ini tidak dapat dibatalkan.</DialogDescription>
        <div className="cashier-confirm-actions">
          <button className="button secondary" type="button" onClick={() => setClearOpen(false)}>Batal</button>
          <button className="button cashier-danger-button" type="button" onClick={clearCart}><Trash2 size={17} /> Ya, kosongkan</button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

type CartPanelProps = {
  lines: CartLine[]; itemCount: number; orderType: OrderType; setOrderType: (value: OrderType) => void;
  customer: string; setCustomer: (value: string) => void; discount: number; setDiscount: (value: string) => void;
  subtotal: number; total: number; stockConflict?: CartLine; changeQuantity: (id: number, delta: number) => void;
  requestClear: () => void; checkout: () => void;
};

function CartPanel({
  lines, itemCount, orderType, setOrderType, customer, setCustomer, discount, setDiscount,
  subtotal, total, stockConflict, changeQuantity, requestClear, checkout,
}: CartPanelProps) {
  return <div className="pos-cart">
    <div className="pos-cart-header">
      <div><span>Pesanan saat ini</span><h2>Detail pesanan <b>{itemCount}</b></h2></div>
      {lines.length > 0 && <button className="pos-cart-clear" type="button" onClick={requestClear} aria-label="Kosongkan pesanan" title="Kosongkan pesanan"><Trash2 size={18} /></button>}
    </div>
    <div className="pos-cart-options">
      <div className="pos-order-types" role="group" aria-label="Tipe pesanan">
        {(["Makan di tempat", "Bawa pulang", "Pesan antar"] as OrderType[]).map((type) => <button type="button" key={type} aria-pressed={orderType === type} className={orderType === type ? "active" : ""} onClick={() => setOrderType(type)}>{type}</button>)}
      </div>
      <label className="pos-customer">
        <span className="sr-only">Nama pelanggan (opsional)</span>
        <UserRound size={18} aria-hidden="true" />
        <input value={customer} maxLength={120} autoComplete="off" onChange={(event) => setCustomer(event.target.value)} placeholder="Nama pelanggan (opsional)" />
      </label>
    </div>

    <div className="pos-cart-lines">
      {lines.length === 0 ? <div className="pos-empty-cart">
        <ShoppingBag size={36} strokeWidth={1.5} />
        <h3>Keranjang masih kosong</h3>
        <p>Pilih produk dari katalog. Pesanan akan muncul di sini.</p>
      </div> : lines.map((line) => <div className={`pos-cart-line ${line.quantity > line.stock ? "stock-error" : ""}`} key={line.id}>
        <ProductImage src={line.imageUrl} name={line.name} className="pos-cart-line-image" />
        <div className="pos-cart-line-main">
          <strong>{line.name}</strong>
          <span>{rupiah(line.price)} / item</span>
          {line.quantity > line.stock && <small role="alert">Stok tersisa {line.stock}. Kurangi jumlah.</small>}
          <div className="pos-quantity" aria-label={`Jumlah ${line.name}`}>
            <button type="button" onClick={() => changeQuantity(line.id, -1)} aria-label={`Kurangi ${line.name}`}><Minus size={16} /></button>
            <output aria-live="polite" aria-label={`${line.quantity} item`}>{line.quantity}</output>
            <button type="button" onClick={() => changeQuantity(line.id, 1)} disabled={line.quantity >= Math.min(line.stock, MAX_QUANTITY)} aria-label={`Tambah ${line.name}`}><Plus size={16} /></button>
          </div>
        </div>
        <strong className="pos-line-total">{rupiah(line.price * line.quantity)}</strong>
      </div>)}
    </div>

    <div className="pos-cart-summary">
      {stockConflict && <p className="pos-stock-warning" role="alert"><AlertCircle size={17} /><span>Jumlah {stockConflict.name} melebihi stok terbaru. Sesuaikan sebelum membayar.</span></p>}
      <div className="pos-subtotal"><span>Subtotal <small>{itemCount} item</small></span><strong>{rupiah(subtotal)}</strong></div>
      <label className="pos-discount"><span>Diskon</span><span className="pos-discount-input"><span>Rp</span><input aria-label="Diskon dalam rupiah" type="text" inputMode="numeric" autoComplete="off" value={formattedMoneyInput(discount)} onChange={(event) => setDiscount(event.target.value)} placeholder="0" disabled={!lines.length} /></span></label>
      <div className="pos-grand-total"><span>Total pembayaran</span><strong>{rupiah(total)}</strong></div>
      <button className="button primary pos-checkout" type="button" disabled={!lines.length || !!stockConflict} onClick={checkout}>
        <span>Pilih pembayaran</span><ChevronRight size={20} />
      </button>
      <p className="pos-checkout-note">Stok diperbarui setelah pembayaran berhasil</p>
    </div>
  </div>;
}

type PaymentProps = {
  open: boolean; onOpenChange: (open: boolean) => void; total: number; subtotal: number; discount: number;
  customer: string; orderType: OrderType; lines: CartLine[];
  onCompleted: (sale: Sale) => void; invalidate: () => void;
};

function PaymentDialog({ open, onOpenChange, total, subtotal, discount, customer, orderType, lines, onCompleted, invalidate }: PaymentProps) {
  const utils = trpc.useUtils();
  const [method, setMethod] = useState<PaymentMethod>("Tunai");
  const [cash, setCash] = useState(0);
  const [formError, setFormError] = useState("");
  const submittingRef = useRef(false);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const mutation = trpc.pos.createTransaction.useMutation({
    onSuccess: (sale) => {
      onCompleted(sale as Sale);
      invalidate();
      void utils.pos.transactions.invalidate();
      void utils.pos.summary.invalidate();
    },
    onError: (mutationError) => {
      submittingRef.current = false;
      setFormError(mutationError.message);
    },
  });

  const updateCash = (value: string) => {
    mutation.reset();
    setFormError("");
    setCash(moneyFromInput(value));
  };
  const selectMethod = (nextMethod: PaymentMethod) => {
    if (mutation.isPending) return;
    mutation.reset();
    setFormError("");
    setMethod(nextMethod);
  };
  const pay = () => {
    if (submittingRef.current || mutation.isPending || !lines.length) return;
    if (method === "Tunai" && cash < total) {
      setFormError(`Uang tunai masih kurang ${rupiah(total - cash)}.`);
      return;
    }
    submittingRef.current = true;
    setFormError("");
    mutation.mutate({
      customerName: customer.trim() || undefined,
      orderType,
      paymentMethod: method,
      discount,
      cashReceived: method === "Tunai" ? cash : total,
      items: lines.map((line) => ({ productId: line.id, quantity: line.quantity })),
    });
  };

  return <Dialog open={open} onOpenChange={(value) => { if (!mutation.isPending) onOpenChange(value); }}>
    <DialogContent className="cashier-payment-dialog" showCloseButton={!mutation.isPending} aria-busy={mutation.isPending}>
      <div className="cashier-payment-heading">
        <DialogTitle>Selesaikan pembayaran</DialogTitle>
        <DialogDescription>{itemCount} item · {orderType}{customer.trim() ? ` · ${customer.trim()}` : ""}</DialogDescription>
      </div>
      <div className="cashier-payment-total"><span>Total yang harus dibayar</span><strong>{rupiah(total)}</strong></div>

      <div className="cashier-payment-methods" role="group" aria-label="Metode pembayaran">
        {([{ name: "Tunai", icon: Banknote, note: "Uang cash" }, { name: "Kartu", icon: CreditCard, note: "Mesin EDC" }] as const).map(({ name, icon: Icon, note }) => <button type="button" key={name} aria-pressed={method === name} className={method === name ? "active" : ""} onClick={() => selectMethod(name)} disabled={mutation.isPending}>
          <Icon size={24} /><span><strong>{name}</strong><small>{note}</small></span>{method === name && <Check size={17} />}
        </button>)}
      </div>

      {method === "Tunai" ? <div className="cashier-cash-panel">
        <label htmlFor="cash-received">Uang diterima</label>
        <div className="cashier-money-input"><span>Rp</span><input id="cash-received" autoFocus type="text" inputMode="numeric" autoComplete="off" value={formattedMoneyInput(cash)} onChange={(event) => updateCash(event.target.value)} placeholder="0" disabled={mutation.isPending} /></div>
        <div className="cashier-quick-cash" aria-label="Pilihan uang tunai cepat">
          {quickCashValues(total).map((value, index) => <button type="button" key={value} className={cash === value ? "active" : ""} onClick={() => { mutation.reset(); setFormError(""); setCash(value); }} disabled={mutation.isPending}><span>{index === 0 ? "Uang pas" : rupiah(value)}</span>{index === 0 && <small>{rupiah(value)}</small>}</button>)}
        </div>
        <div className={`cashier-change ${cash >= total ? "positive" : "insufficient"}`}>
          <span>{cash >= total ? "Kembalian" : "Kekurangan"}</span>
          <strong>{rupiah(Math.abs(cash - total))}</strong>
        </div>
      </div> : <div className="cashier-card-panel">
        <CreditCard size={32} aria-hidden="true" />
        <div><h3>Konfirmasi pembayaran EDC</h3><p>Proses kartu pada mesin EDC toko. Tekan tombol konfirmasi hanya setelah mesin menyatakan pembayaran berhasil.</p></div>
      </div>}

      <div className="cashier-payment-recap">
        <div><span>Subtotal</span><strong>{rupiah(subtotal)}</strong></div>
        {discount > 0 && <div><span>Diskon</span><strong>−{rupiah(discount)}</strong></div>}
      </div>
      {formError && <p className="cashier-payment-error" role="alert"><AlertCircle size={18} /><span>{formError}</span></p>}
      <button className="button primary cashier-pay-button" type="button" onClick={pay} disabled={mutation.isPending || !lines.length || (method === "Tunai" && cash < total)}>
        {mutation.isPending ? "Memproses pembayaran…" : method === "Kartu" ? `Konfirmasi ${rupiah(total)}` : `Bayar ${rupiah(total)}`}
      </button>
      <p className="cashier-payment-note">Periksa kembali total sebelum menyelesaikan transaksi.</p>
    </DialogContent>
  </Dialog>;
}

function ReceiptDialog({ sale, storeLabel, onClose }: { sale: Sale | null; storeLabel: string; onClose: () => void }) {
  return <Dialog open={!!sale} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="cashier-receipt-dialog">
      {sale && <>
        <div className="cashier-receipt-success"><CircleCheckBig size={32} /></div>
        <DialogTitle>Pembayaran berhasil</DialogTitle>
        <DialogDescription>{sale.invoiceNumber}<br />{formatDate(sale.createdAt)}</DialogDescription>
        <div className="receipt-paper">
          <div className="receipt-brand">hey<span>post</span>.</div>
          <p>{storeLabel}</p>
          <div className="receipt-meta"><span>{sale.customerName || "Pelanggan toko"}</span><span>{sale.orderType}</span></div>
          {sale.items.map((item, index) => <div className="receipt-item" key={`${item.productName}-${index}`}><span>{item.quantity}× {item.productName}</span><strong>{rupiah(item.subtotal)}</strong></div>)}
          <div className="cashier-receipt-calculation">
            <div><span>Subtotal</span><span>{rupiah(sale.subtotal)}</span></div>
            {sale.discount > 0 && <div><span>Diskon</span><span>−{rupiah(sale.discount)}</span></div>}
          </div>
          <div className="receipt-total"><span>Total · {sale.paymentMethod}</span><strong>{rupiah(sale.total)}</strong></div>
          {sale.paymentMethod === "Tunai" && <div className="receipt-meta"><span>Tunai {rupiah(sale.cashReceived ?? 0)}</span><span>Kembali {rupiah((sale.cashReceived ?? 0) - sale.total)}</span></div>}
          <p className="receipt-thanks">Terima kasih. Sampai jumpa lagi!</p>
        </div>
        <div className="receipt-actions">
          <button className="button secondary" type="button" onClick={() => window.print()}>Cetak struk</button>
          <button className="button primary" type="button" onClick={onClose}>Transaksi baru</button>
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
