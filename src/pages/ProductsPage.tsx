import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Archive, ImagePlus, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useOutletContext } from "react-router";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/Loading";
import { rupiah } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

type ProductForm = { id?: number; name: string; categoryId: number; price: number; stock: number; imageUrl: string | null };
type ProductPageContext = { mobileSearchQuery: string };
const emptyForm: ProductForm = { name: "", categoryId: 0, price: 0, stock: 0, imageUrl: null };

function ProductThumbnail({ src, name }: { src: string | null; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return <span className="inventory-product-avatar" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase() || "?"}</span>;
  }
  return <img src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} />;
}

export default function ProductsPage() {
  const { mobileSearchQuery } = useOutletContext<ProductPageContext>();
  const { data, isLoading, error, refetch } = trpc.pos.listProducts.useQuery();
  const { data: session } = useAuth();
  const permissions = session?.principal.permissions ?? [];
  const isOwner = session?.principal.role === "owner";
  const canCreateMenu = isOwner || permissions.includes("menu.create");
  const canEditMenu = isOwner || permissions.includes("menu.edit");
  const canEditStock = isOwner || permissions.includes("stock.edit");
  const canEditProducts = canEditMenu || canEditStock;
  const utils = trpc.useUtils();
  const [form, setForm] = useState<ProductForm | null>(null);
  const [categoryForm, setCategoryForm] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  useEffect(() => {
    const openAddMenu = () => setAddMenuOpen(true);
    window.addEventListener("heypost:admin-add", openAddMenu);
    return () => window.removeEventListener("heypost:admin-add", openAddMenu);
  }, []);
  useEffect(() => {
    if (!addMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!target.closest(".products-add-popover, .mobile-admin-add, .products-desktop-add")) setAddMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setAddMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [addMenuOpen]);

  const createCategory = trpc.pos.createCategory.useMutation({
    onSuccess: async () => {
      setCategoryForm(null);
      setAddMenuOpen(false);
      await utils.pos.listProducts.invalidate();
      toast.success("Kategori berhasil ditambahkan");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const create = trpc.pos.createProduct.useMutation({
    onSuccess: async () => {
      setForm(null);
      setAddMenuOpen(false);
      await Promise.all([utils.pos.listProducts.invalidate(), utils.pos.bootstrap.invalidate()]);
      toast.success("Produk berhasil ditambahkan");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const update = trpc.pos.updateProduct.useMutation({
    onSuccess: async () => {
      setForm(null);
      await Promise.all([utils.pos.listProducts.invalidate(), utils.pos.bootstrap.invalidate()]);
      toast.success("Perubahan produk disimpan");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const archive = trpc.pos.archiveProduct.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.pos.listProducts.invalidate(), utils.pos.bootstrap.invalidate()]);
      toast.success("Produk diarsipkan");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const setActive = trpc.pos.setProductActive.useMutation({
    onSuccess: async (_, variables) => {
      await Promise.all([utils.pos.listProducts.invalidate(), utils.pos.bootstrap.invalidate()]);
      toast.success(variables.active ? "Produk diaktifkan" : "Produk dinonaktifkan");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const uploadImage = trpc.pos.uploadProductImage.useMutation();

  const products = useMemo(() => data?.products ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);
  const query = mobileSearchQuery.trim().toLocaleLowerCase("id-ID");
  const filtered = useMemo(
    () => products.filter((product) => !query || `${product.name} ${product.sku}`.toLocaleLowerCase("id-ID").includes(query)),
    [products, query],
  );
  const groupedProducts = useMemo(
    () => categories.map((item) => ({ ...item, products: filtered.filter((product) => product.categoryId === item.id) }))
      .filter((item) => item.products.length > 0),
    [categories, filtered],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form || !form.categoryId) { toast.error("Pilih kategori produk"); return; }
    if (form.id) update.mutate({ ...form, id: form.id });
    else if (canCreateMenu) create.mutate(form);
  };
  const pending = create.isPending || update.isPending || uploadImage.isPending;
  // [MODIFIED] Normalize images to JPEG so Android gallery MIME metadata cannot mismatch the actual file format.
  const selectProductImage = async (file?: File) => {
    if (!file || !form) return;
    if (!file.type.startsWith("image/")) { toast.error("Pilih file gambar."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran foto maksimal 5 MB."); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) {
        bitmap.close();
        throw new Error("Foto tidak bisa diproses di perangkat.");
      }
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const normalizedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Foto tidak bisa dikonversi."));
        }, "image/jpeg", 0.9);
      });
      if (normalizedBlob.size > 5 * 1024 * 1024) {
        toast.error("Ukuran foto setelah diproses melebihi 5 MB.");
        return;
      }
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
      reader.readAsDataURL(normalizedBlob);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Foto tidak bisa diproses di perangkat.");
    }
  };
  return <div className="page-container products-page">
    <header className="products-page-heading">
      <div>
        <h1>Menu</h1>
        <p>{products.length} produk · {categories.length} kategori</p>
      </div>
      {canCreateMenu && <button type="button" className="icon-button products-desktop-add" aria-label="Tambah menu atau kategori" onClick={() => setAddMenuOpen((open) => !open)}><Plus size={20} /></button>}
    </header>

    <div className="products-summary">
      <div><strong>{products.filter((product) => product.active).length}</strong><span>Aktif</span></div>
      <div><strong>{products.filter((product) => !product.active).length}</strong><span>Nonaktif</span></div>
      <div><strong>{products.reduce((sum, product) => sum + product.stock, 0)}</strong><span>Total stok</span></div>
    </div>

    {isLoading ? <Loading /> : error ? <ErrorState message={error.message} retry={() => refetch()} /> : groupedProducts.length === 0 ? (
      <div className="products-empty"><Package size={28} /><strong>{query ? "Menu tidak ditemukan" : "Belum ada menu"}</strong><span>{query ? "Coba kata pencarian lain." : "Tambahkan menu untuk mulai mengelola katalog."}</span></div>
    ) : (
      <div className="products-groups">
        {groupedProducts.map((group) => <section className="products-category" key={group.id}>
          <div className="products-category-heading"><h2>{group.name}</h2><span>{group.products.length} menu</span></div>
          <div className="products-category-list">
            {group.products.map((product) => <article className={`product-management-row ${product.active ? "" : "is-inactive"}`} key={product.id}>
              <ProductThumbnail src={product.imageUrl} name={product.name} />
              <div className="product-management-info">
                <strong>{product.name}</strong>
                <span>{product.sku}</span>
                <div className="product-management-meta"><b>{rupiah(product.price)}</b><span>Stok {product.stock}</span></div>
              </div>
              <div className="product-management-actions">
                {canEditMenu && <button type="button" className="product-active-toggle" role="switch" aria-checked={product.active} aria-label={`${product.active ? "Nonaktifkan" : "Aktifkan"} ${product.name}`} disabled={setActive.isPending} onClick={() => setActive.mutate({ id: product.id, active: !product.active })}><span /></button>}
                {canEditProducts && <button type="button" className="icon-button" aria-label={`Edit ${product.name}`} onClick={() => setForm({ id: product.id, name: product.name, categoryId: product.categoryId, price: product.price, stock: product.stock, imageUrl: product.imageUrl })}><Pencil size={17} /></button>}
                {canEditMenu && <button type="button" className="icon-button danger" aria-label={`Arsipkan ${product.name}`} disabled={archive.isPending} onClick={() => { if (window.confirm(`Arsipkan ${product.name}? Produk akan dihapus dari daftar menu.`)) archive.mutate({ id: product.id }); }}><Archive size={17} /></button>}
              </div>
            </article>)}
          </div>
        </section>)}
      </div>
    )}

    {canCreateMenu && <div className={`products-add-popover ${addMenuOpen ? "is-open" : ""}`} aria-hidden={!addMenuOpen}>
      <button type="button" onClick={() => { setAddMenuOpen(false); setForm({ ...emptyForm, categoryId: categories[0]?.id ?? 0 }); }}><Plus size={17} /><span>Tambah Menu</span></button>
      <button type="button" onClick={() => { setAddMenuOpen(false); setCategoryForm(""); }}><Package size={17} /><span>Tambah Kategori</span></button>
    </div>}

    <Dialog open={categoryForm !== null} onOpenChange={(open) => { if (!open && !createCategory.isPending) setCategoryForm(null); }}>
      <DialogContent className="settings-dialog">
        <form onSubmit={(event) => { event.preventDefault(); if (categoryForm?.trim()) createCategory.mutate({ name: categoryForm.trim(), sortOrder: categories.length }); }}>
          <DialogTitle>Tambah kategori</DialogTitle>
          <DialogDescription>Kategori dibuat untuk outlet yang sedang aktif.</DialogDescription>
          <div className="form-grid"><label className="full">Nama kategori<input autoFocus required minLength={2} maxLength={100} value={categoryForm ?? ""} onChange={(event) => setCategoryForm(event.target.value)} placeholder="Contoh: Minuman" /></label></div>
          <div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setCategoryForm(null)}>Batal</button><button type="submit" className="button primary" disabled={createCategory.isPending || !categoryForm?.trim()}>{createCategory.isPending ? "Menyimpan…" : "Simpan kategori"}</button></div>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={!!form} onOpenChange={(open) => { if (!open && !pending) setForm(null); }}>
      <DialogContent className="product-dialog">
        {form && <form onSubmit={submit}>
          <DialogTitle>{form.id ? "Edit menu" : "Tambah menu"}</DialogTitle>
          <DialogDescription>Atur informasi menu yang tampil di kasir.</DialogDescription>
          <div className="form-grid">
            <label className="full">Nama menu<input required minLength={2} disabled={!!form.id && !canEditMenu} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nama menu" /></label>
            <label>Kategori<select required disabled={!!form.id && !canEditMenu} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: Number(event.target.value) })}><option value={0} disabled>Pilih kategori</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Stok<input disabled={!!form.id && !canEditStock} type="text" inputMode="numeric" pattern="[0-9]*" value={form.stock || ""} onChange={(event) => { const value = event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""); setForm({ ...form, stock: value === "" ? 0 : Number(value) }); }} placeholder="0" /></label>
            <label className="full">Harga jual (Rp)<input disabled={!!form.id && !canEditMenu} required type="number" min="100" step="100" value={form.price || ""} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} placeholder="25000" /></label>
            {(!form.id || canEditMenu) && <div className="full product-photo-field">
              <span className="product-photo-label">Foto menu (opsional)</span>
              <div className="product-photo-preview">{form.imageUrl ? <img src={form.imageUrl} alt="Pratinjau foto menu" /> : <span>{form.name.trim().slice(0, 1).toUpperCase() || "?"}</span>}</div>
              <div className="product-photo-actions">
                <label className="button secondary"><ImagePlus size={17} />{uploadImage.isPending ? "Mengunggah…" : "Pilih foto"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={pending} onChange={(event) => { selectProductImage(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
                {form.imageUrl && <button type="button" className="button secondary" disabled={pending} onClick={() => setForm({ ...form, imageUrl: null })}><Trash2 size={16} /> Hapus foto</button>}
              </div>
              <small>JPG, PNG, WebP, maksimal 5 MB.</small>
            </div>}
          </div>
          <div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setForm(null)}>Batal</button><button type="submit" className="button primary" disabled={pending || (!!form.id && !canEditMenu && !canEditStock)}>{pending ? "Menyimpan…" : "Simpan menu"}</button></div>
        </form>}
      </DialogContent>
    </Dialog>
  </div>;
}
