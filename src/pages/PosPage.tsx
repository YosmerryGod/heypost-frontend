import { useMemo, useState } from "react";
// avoid-ai-design-ignore: I3 — Check is a functional payment-status glyph, not decorative AI imagery.
import { Banknote, Check, ChevronRight, CreditCard, Minus, Plus, Search, ShoppingBag, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/Loading";
import { formatDate, rupiah } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

type ProductView = { id: number; categoryId: number; name: string; price: number; stock: number; imageUrl: string; sku: string };
type Cart = Record<number, number>;
type OrderType = "Makan di tempat" | "Bawa pulang" | "Pesan antar";
type PaymentMethod = "Tunai" | "Kartu";
type Sale = {
  invoiceNumber: string; createdAt: Date; customerName: string | null; orderType: OrderType;
  paymentMethod: PaymentMethod; subtotal: number; discount: number; total: number; cashReceived: number | null;
  items: { productName: string; unitPrice: number; quantity: number; subtotal: number }[];
};

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
  const [completed, setCompleted] = useState<Sale | null>(null);

  const products = useMemo(() => (data?.products ?? []) as ProductView[], [data]);
  const filtered = useMemo(() => products.filter((product) =>
    (category === 0 || product.categoryId === category) && product.name.toLowerCase().includes(search.toLowerCase()),
  ), [products, category, search]);
  const lines = products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] }));
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  const add = (product: ProductView) => {
    if ((cart[product.id] ?? 0) >= product.stock) { toast.error(`Stok ${product.name} hanya ${product.stock}`); return; }
    setCart((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }));
  };
  const changeQuantity = (id: number, delta: number) => setCart((current) => {
    const next = Math.max(0, (current[id] ?? 0) + delta);
    const updated = { ...current, [id]: next };
    if (!next) delete updated[id];
    return updated;
  });

  const cartPanel = <CartPanel
    lines={lines} orderType={orderType} setOrderType={setOrderType} customer={customer} setCustomer={setCustomer}
    discount={discount} setDiscount={setDiscount} subtotal={subtotal} total={total} changeQuantity={changeQuantity}
    clear={() => setCart({})} checkout={() => { setCartOpen(false); setPaymentOpen(true); }}
  />;

  return <div className="pos-layout">
    <section className="catalog-area">
      <header className="page-heading catalog-heading">
        <div><span className="section-kicker">KASIR / TRANSAKSI BARU</span><h1>Mau pesan apa?</h1><p>{new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p></div>
        <button className="mobile-cart-icon" onClick={() => setCartOpen(true)} aria-label={`Buka pesanan, ${itemCount} item`}><ShoppingBag size={22} />{itemCount > 0 && <b>{itemCount}</b>}</button>
      </header>
      <div className="catalog-tools">
        <label className="search-field"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari menu atau nama produk…" aria-label="Cari produk" />{search && <button onClick={() => setSearch("")} aria-label="Hapus pencarian"><X size={17} /></button>}</label>
        <span className="product-count">{filtered.length} produk</span>
      </div>
      <div className="category-scroll" role="tablist" aria-label="Kategori produk">
        <button role="tab" aria-selected={category === 0} className={category === 0 ? "active" : ""} onClick={() => setCategory(0)}>Semua</button>
        {data?.categories.map((item) => <button key={item.id} role="tab" aria-selected={category === item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{item.name}</button>)}
      </div>
      {isLoading ? <Loading label="Memuat katalog…" /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : filtered.length === 0 ? <div className="state-panel">{products.length === 0 ? <ShoppingBag size={28} /> : <Search size={28} />}<h2>{products.length === 0 ? "Belum ada produk aktif" : "Produk tidak ditemukan"}</h2><p>{products.length === 0 ? "Owner atau manager perlu menambahkan produk sebelum transaksi dimulai." : "Coba kata kunci atau kategori lain."}</p></div> : <div className="product-grid">
        {filtered.map((product) => <button className="product-card" key={product.id} onClick={() => add(product)} disabled={product.stock === 0} aria-label={`Tambah ${product.name}, ${rupiah(product.price)}`}>
          <div className="product-image"><img src={product.imageUrl} alt="" loading="lazy" /><span className="add-product"><Plus size={20} /></span>{product.stock <= 8 && <span className="stock-flag">{product.stock === 0 ? "Habis" : `Sisa ${product.stock}`}</span>}</div>
          <div className="product-copy"><h2>{product.name}</h2><div className="product-meta"><p>Stok {product.stock}</p><strong>{rupiah(product.price)}</strong></div></div>
          {cart[product.id] > 0 && <span className="cart-quantity">{cart[product.id]}</span>}
        </button>)}
      </div>}
    </section>
    <aside className="order-panel desktop-order">{cartPanel}</aside>
    {itemCount > 0 && <button className="mobile-cart-bar" onClick={() => setCartOpen(true)}><span><ShoppingBag size={19} /><b>{itemCount} item</b></span><strong>{rupiah(total)}</strong><ChevronRight size={19} /></button>}
    <Dialog open={cartOpen} onOpenChange={setCartOpen}><DialogContent className="mobile-order-dialog" showCloseButton={false}><DialogTitle className="sr-only">Pesanan saat ini</DialogTitle><DialogDescription className="sr-only">Periksa dan ubah pesanan pelanggan</DialogDescription><button className="mobile-cart-close icon-button" onClick={() => setCartOpen(false)} aria-label="Tutup pesanan"><X size={20} /></button>{cartPanel}</DialogContent></Dialog>
    <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} total={total} subtotal={subtotal} discount={discount} customer={customer} orderType={orderType} lines={lines} onCompleted={(sale) => { setPaymentOpen(false); setCompleted(sale); setCart({}); setDiscount(0); setCustomer(""); }} invalidate={() => { refetch(); }} />
    <ReceiptDialog sale={completed} storeLabel={session ? `${session.store.name} — ${session.outlets.find((outlet) => outlet.id === session.activeOutletId)?.name ?? "Outlet aktif"}` : "heypost"} onClose={() => { setCompleted(null); setPaymentOpen(false); }} />
  </div>;
}

type CartPanelProps = {
  lines: (ProductView & { quantity: number })[]; orderType: OrderType; setOrderType: (value: OrderType) => void;
  customer: string; setCustomer: (value: string) => void; discount: number; setDiscount: (value: number) => void;
  subtotal: number; total: number; changeQuantity: (id: number, delta: number) => void; clear: () => void; checkout: () => void;
};
function CartPanel({ lines, orderType, setOrderType, customer, setCustomer, discount, setDiscount, subtotal, total, changeQuantity, clear, checkout }: CartPanelProps) {
  return <div className="cart-panel-inner">
    <div className="cart-title"><div><span className="section-kicker">{lines.length ? `${lines.reduce((sum, line) => sum + line.quantity, 0)} ITEM DIPILIH` : "PESANAN SAAT INI"}</span><h2>Detail pesanan</h2></div>{lines.length > 0 && <button className="icon-button subtle" onClick={clear} aria-label="Kosongkan pesanan"><Trash2 size={18} /></button>}</div>
    <div className="order-types" aria-label="Tipe pesanan">{(["Makan di tempat", "Bawa pulang", "Pesan antar"] as OrderType[]).map((type) => <button key={type} aria-pressed={orderType === type} className={orderType === type ? "active" : ""} onClick={() => setOrderType(type)}>{type}</button>)}</div>
    <label className="customer-field"><UserRound size={17} /><input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Nama pelanggan (opsional)" /></label>
    <div className="cart-lines">
      {lines.length === 0 ? <div className="empty-cart"><ShoppingBag size={34} strokeWidth={1.5} /><h3>Belum ada pesanan</h3><p>Pilih produk dari katalog untuk mulai membuat transaksi.</p></div> : lines.map((line) => <div className="cart-line" key={line.id}>
        <img src={line.imageUrl} alt="" /><div className="cart-line-copy"><strong>{line.name}</strong><span>{rupiah(line.price)}</span><div className="quantity-stepper"><button onClick={() => changeQuantity(line.id, -1)} aria-label={`Kurangi ${line.name}`}><Minus size={15} /></button><b>{line.quantity}</b><button onClick={() => changeQuantity(line.id, 1)} disabled={line.quantity >= line.stock} aria-label={`Tambah ${line.name}`}><Plus size={15} /></button></div></div><strong className="line-total">{rupiah(line.price * line.quantity)}</strong>
      </div>)}
    </div>
    <div className="cart-summary">
      <div><span>Subtotal</span><strong>{rupiah(subtotal)}</strong></div>
      <label><span>Diskon (Rp)</span><input type="number" min="0" max={subtotal} step="1000" value={discount || ""} onChange={(event) => setDiscount(Math.min(subtotal, Math.max(0, Number(event.target.value))))} placeholder="0" /></label>
      <div className="grand-total"><span>Total</span><strong>{rupiah(total)}</strong></div>
      <button className="button primary checkout-button" disabled={!lines.length} onClick={checkout}>Pilih pembayaran <ChevronRight size={19} /></button>
      <p className="checkout-note">Stok diperbarui setelah pembayaran berhasil</p>
    </div>
  </div>;
}

type PaymentProps = {
  open: boolean; onOpenChange: (open: boolean) => void; total: number; subtotal: number; discount: number;
  customer: string; orderType: OrderType; lines: (ProductView & { quantity: number })[];
  onCompleted: (sale: Sale) => void; invalidate: () => void;
};
function PaymentDialog({ open, onOpenChange, total, subtotal, discount, customer, orderType, lines, onCompleted, invalidate }: PaymentProps) {
  const utils = trpc.useUtils();
  const [method, setMethod] = useState<PaymentMethod>("Tunai");
  const [cash, setCash] = useState(0);
  const mutation = trpc.pos.createTransaction.useMutation({
    onSuccess: (sale) => { onCompleted(sale as Sale); invalidate(); utils.pos.transactions.invalidate(); utils.pos.summary.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const pay = () => {
    if (method === "Tunai" && cash < total) { toast.error("Jumlah uang tunai masih kurang"); return; }
    mutation.mutate({ customerName: customer || undefined, orderType, paymentMethod: method, discount, cashReceived: method === "Tunai" ? cash : total, items: lines.map((line) => ({ productId: line.id, quantity: line.quantity })) });
  };
  return <Dialog open={open} onOpenChange={(value) => { if (!mutation.isPending) onOpenChange(value); }}><DialogContent className="payment-dialog">
    <DialogTitle>Pembayaran</DialogTitle><DialogDescription>Selesaikan pesanan senilai <strong>{rupiah(total)}</strong></DialogDescription>
    <div className="payment-methods">{([{ name: "Tunai", icon: Banknote }, { name: "Kartu", icon: CreditCard }] as const).map(({ name, icon: Icon }) => <button key={name} aria-pressed={method === name} className={method === name ? "active" : ""} onClick={() => setMethod(name)}><Icon size={23} /><span>{name}</span>{method === name && <Check size={16} />}</button>)}</div>
    {method === "Tunai" && <div className="cash-panel"><label>Uang diterima<div className="money-input"><span>Rp</span><input autoFocus type="number" min="0" step="1000" value={cash || ""} onChange={(event) => setCash(Number(event.target.value))} placeholder="0" /></div></label><div className="quick-cash">{[total, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000].filter((value, index, array) => array.indexOf(value) === index).map((value) => <button key={value} onClick={() => setCash(value)}>{rupiah(value)}</button>)}</div><div className={`change-row ${cash >= total ? "positive" : ""}`}><span>Kembalian</span><strong>{rupiah(Math.max(0, cash - total))}</strong></div></div>}
    {method === "Kartu" && <div className="card-panel"><CreditCard size={38} /><h3>Pembayaran kartu</h3><p>Gunakan mesin EDC toko, lalu konfirmasi transaksi setelah pembayaran berhasil.</p></div>}
    <div className="payment-recap"><span>Subtotal {lines.reduce((sum, line) => sum + line.quantity, 0)} item</span><span>{rupiah(subtotal)}{discount > 0 && ` · Diskon ${rupiah(discount)}`}</span></div>
    <button className="button primary pay-button" onClick={pay} disabled={mutation.isPending || (method === "Tunai" && cash < total)}>{mutation.isPending ? "Memproses…" : `Bayar ${rupiah(total)}`}</button>
  </DialogContent></Dialog>;
}

function ReceiptDialog({ sale, storeLabel, onClose }: { sale: Sale | null; storeLabel: string; onClose: () => void }) {
  return <Dialog open={!!sale} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="receipt-dialog">
    {sale && <><div className="success-mark"><Check size={30} /></div><DialogTitle>Pembayaran berhasil</DialogTitle><DialogDescription>{sale.invoiceNumber} · {formatDate(sale.createdAt)}</DialogDescription><div className="receipt-paper"><div className="receipt-brand">hey<span>post</span>.</div><p>{storeLabel}</p><div className="receipt-meta"><span>{sale.customerName}</span><span>{sale.orderType}</span></div>{sale.items.map((item, index) => <div className="receipt-item" key={index}><span>{item.quantity}× {item.productName}</span><strong>{rupiah(item.subtotal)}</strong></div>)}<div className="receipt-total"><span>Total · {sale.paymentMethod}</span><strong>{rupiah(sale.total)}</strong></div>{sale.paymentMethod === "Tunai" && <div className="receipt-meta"><span>Tunai {rupiah(sale.cashReceived ?? 0)}</span><span>Kembali {rupiah((sale.cashReceived ?? 0) - sale.total)}</span></div>}<p className="receipt-thanks">Terima kasih. Sampai jumpa lagi!</p></div><div className="receipt-actions"><button className="button secondary" onClick={() => window.print()}>Cetak struk</button><button className="button primary" onClick={onClose}>Transaksi baru</button></div></>}
  </DialogContent></Dialog>;
}
