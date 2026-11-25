import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Archive, ImagePlus, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/Loading";
import { rupiah } from "@/lib/format";

// [MODIFIED] Keep imageUrl as an empty string when a product has no photo.
type ProductForm = { id?: number; name: string; categoryId: number; price: number; stock: number; imageUrl: string | null };
const emptyForm: ProductForm = { name: "", categoryId: 0, price: 0, stock: 0, imageUrl: null };

// [ADDED] Show the first letter of the product name when no usable photo exists.
function ProductThumbnail({ src, name }: { src: string | null; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return <span className="inventory-product-avatar" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase() || "?"}</span>;
  }
  return <img src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} />;
}

export default function ProductsPage() {
  const { data, isLoading, error, refetch } = trpc.pos.bootstrap.useQuery();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(0);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [categoryForm, setCategoryForm] = useState<string | null>(null);
  const createCategory = trpc.pos.createCategory.useMutation({
    onSuccess: () => { setCategoryForm(null); toast.success("Kategori berhasil ditambahkan"); utils.pos.bootstrap.invalidate(); },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const create = trpc.pos.createProduct.useMutation({ onSuccess: () => { toast.success("Produk berhasil ditambahkan"); closeAndRefresh(); } });
  const update = trpc.pos.updateProduct.useMutation({ onSuccess: () => { toast.success("Perubahan produk disimpan"); closeAndRefresh(); } });
  const archive = trpc.pos.archiveProduct.useMutation({ onSuccess: () => { toast.success("Produk diarsipkan"); closeAndRefresh(); } });
  const uploadImage = trpc.pos.uploadProductImage.useMutation();
  function closeAndRefresh() { setForm(null); utils.pos.bootstrap.invalidate(); }
  const products = useMemo(() => data?.products ?? [], [data]);
  const filtered = useMemo(() => products.filter((product) => (category === 0 || product.categoryId === category) && `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase())), [products, category, search]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form || !form.categoryId) { toast.error("Pilih kategori produk"); return; }
    if (form.id) update.mutate({ ...form, id: form.id });
    else create.mutate(form);
  };
  const pending = create.isPending || update.isPending || uploadImage.isPending;
  const selectProductImage = (file?: File) => {
    if (!file || !form) return;
    if (!file.type.startsWith("image/")) { toast.error("Pilih file gambar."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran foto maksimal 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      uploadImage.mutate({ dataUrl: String(reader.result ?? "") }, {
        onSuccess: (result) => {
          setForm((current) => current ? { ...current, imageUrl: result.imageUrl } : current);
          toast.success("Foto berhasil diunggah");
        },
        onError: (mutationError) => toast.error(mutationError.message),
      });
    };
    reader.onerror = () => toast.error("Foto tidak bisa dibaca dari perangkat.");
    reader.readAsDataURL(file);
  };
  return <div className="page-container">
    <header className="page-heading"><div><span className="section-kicker">INVENTORI</span><h1>Produk & stok</h1><p>Kelola menu, harga, dan ketersediaan dalam satu tempat.</p></div><div className="page-actions"><button className="button secondary" onClick={() => setCategoryForm("")}><Plus size={18} /> Kategori</button><button className="button primary" disabled={!data?.categories.length} title={!data?.categories.length ? "Buat kategori terlebih dahulu" : undefined} onClick={() => setForm({ ...emptyForm })}><Plus size={18} /> Tambah produk</button></div></header>
    <div className="inventory-strip"><Package size={21} /><div><strong>{products.length} produk aktif</strong><span>{products.filter((product) => product.stock <= 8).length} produk perlu perhatian stok</span></div><div className="inventory-total"><span>Total unit</span><strong>{products.reduce((sum, product) => sum + product.stock, 0)}</strong></div></div>
    <div className="list-toolbar"><label className="search-field"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau SKU…" aria-label="Cari produk" /></label><select value={category} onChange={(event) => setCategory(Number(event.target.value))} aria-label="Filter kategori"><option value={0}>Semua kategori</option>{data?.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    {isLoading ? <Loading /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : <div className="inventory-list"><div className="inventory-head"><span>Produk</span><span>Kategori</span><span>Stok</span><span>Harga</span><span>Aksi</span></div>{filtered.map((product) => <div className="inventory-row" key={product.id}><div className="inventory-product"><ProductThumbnail src={product.imageUrl} name={product.name} /><div><strong>{product.name}</strong><span>{product.sku}</span></div></div><span>{data?.categories.find((item) => item.id === product.categoryId)?.name}</span><span className={product.stock <= 8 ? "low-stock" : "stock-good"}><i />{product.stock} unit</span><strong>{rupiah(product.price)}</strong><div className="row-actions"><button className="icon-button" onClick={() => setForm({ id: product.id, name: product.name, categoryId: product.categoryId, price: product.price, stock: product.stock, imageUrl: product.imageUrl })} aria-label={`Edit ${product.name}`}><Pencil size={17} /></button><button className="icon-button danger" disabled={archive.isPending} onClick={() => { if (window.confirm(`Arsipkan ${product.name}? Produk tidak akan tampil di kasir.`)) archive.mutate({ id: product.id }); }} aria-label={`Arsipkan ${product.name}`}><Archive size={17} /></button></div></div>)}{filtered.length === 0 && <div className="inline-empty">Tidak ada produk yang cocok dengan pencarian atau filter ini.</div>}</div>}
    <Dialog open={categoryForm !== null} onOpenChange={(open) => { if (!open && !createCategory.isPending) setCategoryForm(null); }}><DialogContent className="settings-dialog"><form onSubmit={(event) => { event.preventDefault(); if (categoryForm?.trim()) createCategory.mutate({ name: categoryForm.trim(), sortOrder: data?.categories.length ?? 0 }); }}><DialogTitle>Tambah kategori</DialogTitle><DialogDescription>Kategori hanya dibuat untuk outlet yang sedang dibuka.</DialogDescription><div className="form-grid"><label className="full">Nama kategori<input autoFocus required minLength={2} maxLength={100} value={categoryForm ?? ""} onChange={(event) => setCategoryForm(event.target.value)} placeholder="Contoh: Minuman dingin" /></label></div><div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setCategoryForm(null)}>Batal</button><button type="submit" className="button primary" disabled={createCategory.isPending || !categoryForm?.trim()}>{createCategory.isPending ? "Menyimpan…" : "Simpan kategori"}</button></div></form></DialogContent></Dialog>
    <Dialog open={!!form} onOpenChange={(open) => { if (!open && !pending) setForm(null); }}><DialogContent className="product-dialog">{form && <form onSubmit={submit}><DialogTitle>{form.id ? "Edit produk" : "Tambah produk"}</DialogTitle><DialogDescription>Lengkapi informasi yang tampil di katalog kasir.</DialogDescription><div className="form-grid"><label className="full">Nama produk<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Masukkan nama produk" /></label><label>Kategori<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: Number(event.target.value) })}><option value={0} disabled>Pilih kategori</option>{data?.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Stok (unit)<input type="text" inputMode="numeric" pattern="[0-9]*" value={form.stock || ""} onChange={(event) => { const value = event.target.value.replace(/\\D/g, "").replace(/^0+(?=\\d)/, ""); setForm({ ...form, stock: value === "" ? 0 : Number(value) }); }} placeholder="0" /></label><label className="full">Harga jual (Rp)<input required type="number" min="100" step="100" value={form.price || ""} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} placeholder="25000" /></label><div className="full product-photo-field"><span className="product-photo-label">Foto produk (opsional)</span><div className="product-photo-preview">{form.imageUrl ? <img src={form.imageUrl} alt="Pratinjau foto produk" /> : <span>{form.name.trim().slice(0, 1).toUpperCase() || "?"}</span>}</div><div className="product-photo-actions"><label className="button secondary"><ImagePlus size={17} />{uploadImage.isPending ? "Mengunggah…" : "Pilih foto"}<input type="file" accept="image/*" hidden disabled={pending} onChange={(event) => { selectProductImage(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{form.imageUrl && <button type="button" className="button secondary" disabled={pending} onClick={() => setForm({ ...form, imageUrl: null })}><Trash2 size={16} /> Hapus foto</button>}</div><small>Pilih dari galeri atau kamera. Format JPG, PNG, WebP, maksimal 5 MB. Jika kosong, huruf awal nama produk akan ditampilkan.</small></div></div><div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setForm(null)}>Batal</button><button type="submit" className="button primary" disabled={pending}>{pending ? "Menyimpan…" : "Simpan produk"}</button></div></form>}</DialogContent></Dialog>
  </div>;
}
