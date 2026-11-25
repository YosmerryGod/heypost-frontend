import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

// Kontrak tipe frontend untuk API heypost. Modul ini hanya diimpor sebagai tipe
// dan tidak menjadi bagian dari bundle browser atau implementasi server.
const t = initTRPC.create({ transformer: superjson });
const procedure = t.procedure;
const typeOnly = () => { throw new Error("Kontrak tipe tidak dapat dijalankan"); };

const role = z.enum(["owner", "manager", "kasir"]);
const employeeRole = z.enum(["manager", "kasir"]);
const store = z.object({ id: z.number(), name: z.string(), createdAt: z.date(), updatedAt: z.date() });
const outlet = z.object({
  id: z.number(), storeId: z.number(), name: z.string(), address: z.string().nullable(),
  active: z.boolean(), createdAt: z.date(), updatedAt: z.date(),
});
const authPayload = z.object({
  principal: z.object({
    name: z.string(), email: z.string().nullable(), role,
    userId: z.number().nullable(), employeeId: z.number().nullable(),
  }),
  store,
  outlets: z.array(outlet),
  activeOutletId: z.number(),
});
const category = z.object({ id: z.number(), name: z.string(), sortOrder: z.number() });
const product = z.object({
  id: z.number(), categoryId: z.number(), name: z.string(), sku: z.string(),
  price: z.number(), stock: z.number(), imageUrl: z.string().nullable(), active: z.boolean(), createdAt: z.date(),
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
const employee = z.object({
  id: z.number(), name: z.string(), role: employeeRole, outletId: z.number(), outletName: z.string(),
  active: z.boolean(), lockedUntil: z.date().nullable(), lastLoginAt: z.date().nullable(), createdAt: z.date(),
});
const summary = z.object({
  revenue: z.number(), orders: z.number(), itemsSold: z.number(), average: z.number(),
  daily: z.array(z.object({ date: z.string(), label: z.string(), revenue: z.number(), orders: z.number() })),
  topProducts: z.array(z.object({ name: z.string(), quantity: z.number(), revenue: z.number() })),
  payments: z.array(z.object({ method: z.string(), total: z.number() })),
});

export const appRouter = t.router({
  auth: t.router({
    register: procedure.input(z.object({
      name: z.string(), storeName: z.string(), outletName: z.string().optional(),
      email: z.string(), password: z.string(),
    })).output(authPayload).mutation(typeOnly),
    login: procedure.input(z.object({ email: z.string(), password: z.string() })).output(authPayload).mutation(typeOnly),
    employeeLogin: procedure.input(z.object({ barcode: z.string(), pin: z.string() })).output(authPayload).mutation(typeOnly),
    me: procedure.output(authPayload.nullable()).query(typeOnly),
    logout: procedure.output(z.object({ ok: z.boolean() })).mutation(typeOnly),
  }),
  store: t.router({
    createOutlet: procedure.input(z.object({
      name: z.string(), address: z.string().optional(), copyMenuFromOutletId: z.number().optional(),
    })).output(outlet).mutation(typeOnly),
    switchOutlet: procedure.input(z.object({ outletId: z.number() })).output(z.object({ ok: z.boolean(), activeOutletId: z.number() })).mutation(typeOnly),
    updateOutlet: procedure.input(z.object({
      id: z.number(), name: z.string().optional(), address: z.string().nullable().optional(), active: z.boolean().optional(),
    })).output(z.object({ ok: z.boolean() })).mutation(typeOnly),
  }),
  employees: t.router({
    list: procedure.output(z.array(employee)).query(typeOnly),
    create: procedure.input(z.object({
      name: z.string(), role: employeeRole, outletId: z.number(), pin: z.string(),
    })).output(z.object({
      id: z.number(), name: z.string(), role: employeeRole, outletId: z.number(),
      active: z.boolean(), createdAt: z.date(), barcode: z.string(),
    })).mutation(typeOnly),
    update: procedure.input(z.object({
      id: z.number(), name: z.string().optional(), role: employeeRole.optional(), outletId: z.number().optional(),
      active: z.boolean().optional(), pin: z.string().optional(),
    })).output(z.object({ ok: z.boolean() })).mutation(typeOnly),
    regenerateBarcode: procedure.input(z.object({ id: z.number() })).output(z.object({ barcode: z.string() })).mutation(typeOnly),
  }),
  pos: t.router({
    bootstrap: procedure.output(z.object({
      products: z.array(product), categories: z.array(category), outlet, role,
    })).query(typeOnly),
    createCategory: procedure.input(z.object({ name: z.string(), sortOrder: z.number().default(0) })).output(category).mutation(typeOnly),
    uploadProductImage: procedure.input(z.object({ dataUrl: z.string() })).output(z.object({ imageUrl: z.string() })).mutation(typeOnly),\n    createProduct: procedure.input(productInput).output(product).mutation(typeOnly),
    updateProduct: procedure.input(productInput.extend({ id: z.number() })).output(product).mutation(typeOnly),
    archiveProduct: procedure.input(z.object({ id: z.number() })).output(z.object({ ok: z.boolean() })).mutation(typeOnly),
    createTransaction: procedure.input(z.object({
      customerName: z.string().optional(), orderType, paymentMethod,
      discount: z.number().default(0), cashReceived: z.number().optional(),
      items: z.array(z.object({ productId: z.number(), quantity: z.number() })),
    })).output(transaction.extend({ items: z.array(saleItem) })).mutation(typeOnly),
    transactions: procedure.output(z.array(transaction.extend({ items: z.array(transactionItem) }))).query(typeOnly),
    summary: procedure.input(z.object({
      range: z.enum(["today", "week", "month", "all"]).default("week"), allOutlets: z.boolean().default(false),
    })).output(summary).query(typeOnly),
  }),
});

export type AppRouter = typeof appRouter;
