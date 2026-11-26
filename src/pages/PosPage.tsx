import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router";
import {
  AlertCircle,
  Banknote,
  Check,
  ChevronRight,
  CircleCheckBig,
  CreditCard,
  Minus,
  PackageOpen,
  Plus,
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

type ProductView = { id: number; categoryId: number; name: string; price: number; stock: number; imageUrl: string | null; sku: string };
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

function ProductImage({ src, name, className = "" }: { src: string | null; name: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    // [MODIFIED] Use only the product initial when the photo is missing or cannot load.
    return <div className={`cashier-image-fallback ${className}`} aria-hidden="true"><span>{name.trim().slice(0, 1).toUpperCase() || "?"}</span></div>;
  }
  return <img className={className} src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} />;
}

export default function PosPage() {
  const { data, isLoading, error, refetch } = trpc.pos.bootstrap.useQuery();
  const { data: session } = useAuth();
  const { data: receiptSettings } = trpc.store.getReceiptSettings.useQuery();
  // [ADDED] Report cart quantity and expose the existing cart dialog to the app header.
  const { registerMobileCart, mobileSearchQuery } = useOutletContext<{ registerMobileCart: (count: number, openCart: (() => void) | null) => void; mobileSearchQuery: string }>();
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

  const products = useMemo(() => (data?.products ?? []) as ProductView[], [data]);
  const visibleProducts = useMemo(() => {
    const query = mobileSearchQuery.trim().toLocaleLowerCase("id-ID");
    return query ? products.filter((product) => product.name.toLocaleLowerCase("id-ID").includes(query)) : products;
  }, [products, mobileSearchQuery]);
  // [MODIFIED] Katalog ditampilkan sebagai daftar per kategori, bukan hasil filter.
  const categoryGroups = useMemo(() => {
    const categories = data?.categories ?? [];
    const groups = categories
      .map((item) => ({
        id: item.id,
        name: item.name,
        products: visibleProducts.filter((product) => product.categoryId === item.id),
      }))
      .filter((group) => group.products.length > 0);
    const groupedProductIds = new Set(groups.flatMap((group) => group.products.map((product) => product.id)));
    const uncategorized = visibleProducts.filter((product) => !groupedProductIds.has(product.id));
    if (uncategorized.length > 0) groups.push({ id: 0, name: "Menu lainnya", products: uncategorized });
    return groups;
  }, [data, visibleProducts]);
  const lines = useMemo(
    () => products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] })),
    [products, cart],
  );
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  // [ADDED] Keep the header badge synchronized with the total quantity in the cart.
  useEffect(() => {
    registerMobileCart(itemCount, () => setCartOpen(true));
  }, [itemCount, registerMobileCart]);
  useEffect(() => () => registerMobileCart(0, null), [registerMobileCart]);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const appliedDiscount = Math.min(discount, subtotal);
  const total = Math.max(0, subtotal - appliedDiscount);
  const stockConflict = lines.find((line) => line.quantity > line.stock);

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
      {isLoading ? <Loading label="Memuat menu…" /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : products.length === 0 ? <div className="state-panel cashier-empty-state">
        <PackageOpen size={30} />
        <h2>Belum ada menu</h2>
      </div> : visibleProducts.length === 0 ? <div className="state-panel cashier-empty-state">
        <PackageOpen size={30} />
        <h2>Menu tidak ditemukan</h2>
      </div> : <div className="cashier-category-list">
        {categoryGroups.map((group) => <section className="cashier-menu-group" key={group.id} aria-labelledby={`cashier-category-${group.id}`}>
          <h2 id={`cashier-category-${group.id}`}>{group.name}</h2>
          <div className="cashier-menu-items">
            {group.products.map((product) => {
              const quantity = cart[product.id] ?? 0;
              const soldOut = product.stock === 0;
              return <article className={`cashier-menu-item ${quantity > 0 ? "in-cart" : ""} ${soldOut ? "sold-out" : ""}`} key={product.id}>
                <ProductImage src={product.imageUrl} name={product.name} className="cashier-menu-image" />
                <div className="cashier-menu-copy">
                  <h3>{product.name}</h3>
                  <strong>{rupiah(product.price)}</strong>
                  {soldOut && <span className="cashier-menu-stock">Habis</span>}
                </div>
                <div className="cashier-menu-stepper" aria-label={`Jumlah ${product.name}`}>
                  <button type="button" onClick={() => changeQuantity(product.id, -1)} disabled={quantity === 0} aria-label={`Kurangi ${product.name}`}>
                    <Minus size={17} />
                  </button>
                  <output aria-live="polite" aria-label={`${quantity} ${product.name}`}>{quantity}</output>
                  <button type="button" onClick={() => add(product)} disabled={soldOut || quantity >= Math.min(product.stock, MAX_QUANTITY)} aria-label={`Tambah ${product.name}`}>
                    <Plus size={17} />
                  </button>
                </div>
              </article>;
            })}
          </div>
        </section>)}
      </div>}
    </section>

    <aside className="cashier-order cashier-order-desktop" aria-label="Pesanan saat ini">{cartPanel}</aside>

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
      logoUrl={session?.store.logoUrl ?? null}
      outlet={session?.outlets.find((outlet) => outlet.id === session.activeOutletId)}
      settings={receiptSettings}
      cashierName={session?.principal.name ?? ""}
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

function ReceiptDialog({ sale, storeLabel, logoUrl, outlet, settings, cashierName, onClose }: {
  sale: Sale | null; storeLabel: string; logoUrl: string | null;
  outlet?: { address: string | null; whatsappNumber: string | null };
  settings?: { showLogo: boolean; showStoreName: boolean; showOutletName: boolean; showAddress: boolean; showWhatsapp: boolean; showCashier: boolean; showCustomer: boolean; showHeyPostWatermark: boolean; footerMessage: string | null };
  cashierName: string; onClose: () => void;
}) {
  const flags = settings ?? { showLogo: true, showStoreName: true, showOutletName: true, showAddress: true, showWhatsapp: true, showCashier: true, showCustomer: true, showHeyPostWatermark: true, footerMessage: null };
  const [storeName, outletName] = storeLabel.split(" — ");
  return <Dialog open={!!sale} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="cashier-receipt-dialog">
      {sale && <>
        <div className="cashier-receipt-success"><CircleCheckBig size={32} /></div>
        <DialogTitle>Pembayaran berhasil</DialogTitle>
        <DialogDescription>{sale.invoiceNumber}<br />{formatDate(sale.createdAt)}</DialogDescription>
        <div className="receipt-paper receipt-paper-thermal">
          <header className="receipt-header">
            {flags.showLogo && logoUrl && <img className="receipt-store-logo" src={logoUrl} alt="Logo toko" />}
            {flags.showStoreName && <h3 className="receipt-store-name">{storeName}</h3>}
            {flags.showOutletName && <p className="receipt-outlet-name">{outletName}</p>}
            {flags.showAddress && outlet?.address && <p>{outlet.address}</p>}
            {flags.showWhatsapp && outlet?.whatsappNumber && <p>WhatsApp: {outlet.whatsappNumber}</p>}
          </header>
          <div className="receipt-divider" />
          <section className="receipt-information" aria-label="Informasi transaksi">
            <div><span>No. Transaksi</span><strong>{sale.invoiceNumber}</strong></div>
            <div><span>Tanggal</span><strong>{formatDate(sale.createdAt)}</strong></div>
            {flags.showCashier && <div><span>Kasir</span><strong>{cashierName || "—"}</strong></div>}
            {flags.showCustomer && <div><span>Pelanggan</span><strong>{sale.customerName || "Pelanggan toko"}</strong></div>}
            <div><span>Tipe pesanan</span><strong>{sale.orderType}</strong></div>
          </section>
          <div className="receipt-divider" />
          <section className="receipt-products" aria-label="Detail pesanan">
            <strong className="receipt-section-label">DETAIL PESANAN</strong>
            {sale.items.map((item, index) => <div className="receipt-product" key={`${item.productName}-${index}`}>
              <div className="receipt-product-heading"><strong>{item.productName}</strong><strong>{rupiah(item.subtotal)}</strong></div>
              <span>{item.quantity} × {rupiah(item.unitPrice)}</span>
            </div>)}
          </section>
          <div className="receipt-divider" />
          <section className="receipt-payment" aria-label="Ringkasan pembayaran">
            <div><span>Subtotal</span><strong>{rupiah(sale.subtotal)}</strong></div>
            {sale.discount > 0 && <div><span>Diskon</span><strong>−{rupiah(sale.discount)}</strong></div>}
            <div className="receipt-grand-total"><span>TOTAL</span><strong>{rupiah(sale.total)}</strong></div>
            <div><span>Metode pembayaran</span><strong>{sale.paymentMethod}</strong></div>
            {sale.paymentMethod === "Tunai" && <>
              <div><span>Tunai diterima</span><strong>{rupiah(sale.cashReceived ?? 0)}</strong></div>
              <div><span>Kembalian</span><strong>{rupiah((sale.cashReceived ?? 0) - sale.total)}</strong></div>
            </>}
          </section>
          <div className="receipt-divider" />
          <footer className="receipt-footer">
            {flags.footerMessage && <p className="receipt-thanks">{flags.footerMessage}</p>}
            {flags.showHeyPostWatermark && <p className="receipt-thanks">Powered by HeyPost</p>}
          </footer>
        </div>
        <div className="receipt-actions">
          <button className="button secondary" type="button" onClick={() => window.print()}>Cetak struk</button>
          <button className="button primary" type="button" onClick={onClose}>Transaksi baru</button>
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
