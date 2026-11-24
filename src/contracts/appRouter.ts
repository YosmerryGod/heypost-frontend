import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

// Kontrak tipe frontend untuk API heypost. Modul ini hanya diimpor sebagai tipe
// dan tidak menjadi bagian dari bundle browser atau implementasi server.
const t = initTRPC.create({ transformer: superjson });
const procedure = t.procedure;
const typeOnly = () => { throw new Error("Kontrak tipe tidak dapat dijalankan"); };

const category = z.object({ id: z.number(), name: z.string(), sortOrder: z.number() });
const product = z.object({
  id: z.number(), categoryId: z.number(), name: z.string(), sku: z.string(),
  price: z.number(), stock: z.number(), imageUrl: z.string(), active: z.boolean(), createdAt: z.date(),
});
const productInput = z.object({
  name: z.string(), categoryId: z.number(), price: z.number(), stock: z.number(), imageUrl: z.string(),
});
const orderType = z.enum(["Makan di tempat", "Bawa pulang", "Pesan antar"]);
const paymentMethod = z.enum(["Tunai", "QRIS", "Kartu"]);
const saleItem = z.object({ productName: z.string(), unitPrice: z.number(), quantity: z.number(), subtotal: z.number() });
const transaction = z.object({
  id: z.number(), invoiceNumber: z.string(), customerName: z.string().nullable(),
  orderType, paymentMethod, status: z.enum(["Selesai", "Dibatalkan"]),
  subtotal: z.number(), discount: z.number(), total: z.number(), cashReceived: z.number().nullable(), createdAt: z.date(),
});
const transactionItem = saleItem.extend({ id: z.number(), transactionId: z.number(), productId: z.number() });

export const appRouter = t.router({
  pos: t.router({
    bootstrap: procedure.output(z.object({ products: z.array(product), categories: z.array(category) })).query(typeOnly),
    createProduct: procedure.input(productInput).output(product).mutation(typeOnly),
    updateProduct: procedure.input(productInput.extend({ id: z.number() })).output(product).mutation(typeOnly),
    archiveProduct: procedure.input(z.object({ id: z.number() })).output(z.object({ ok: z.boolean() })).mutation(typeOnly),
    createTransaction: procedure.input(z.object({
      customerName: z.string().optional(), orderType, paymentMethod,
      discount: z.number().default(0), cashReceived: z.number().optional(),
      items: z.array(z.object({ productId: z.number(), quantity: z.number() })),
    })).output(transaction.extend({ items: z.array(saleItem) })).mutation(typeOnly),
    transactions: procedure.output(z.array(transaction.extend({ items: z.array(transactionItem) }))).query(typeOnly),
    summary: procedure.input(z.object({ range: z.enum(["today", "week", "month", "all"]).default("week") })).output(z.object({
      revenue: z.number(), orders: z.number(), itemsSold: z.number(), average: z.number(),
      daily: z.array(z.object({ date: z.string(), label: z.string(), revenue: z.number(), orders: z.number() })),
      topProducts: z.array(z.object({ name: z.string(), quantity: z.number(), revenue: z.number() })),
      payments: z.array(z.object({ method: z.string(), total: z.number() })),
    })).query(typeOnly),
  }),
});

export type AppRouter = typeof appRouter;
