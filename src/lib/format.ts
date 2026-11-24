export const rupiah = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
}).format(value).replace("Rp", "Rp ");

export const shortRupiah = (value: number) => value >= 1_000_000
  ? `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
  : value >= 1_000 ? `Rp ${Math.round(value / 1_000)} rb` : rupiah(value);

export const formatDate = (date: Date | string, withTime = true) => new Intl.DateTimeFormat("id-ID", {
  day: "numeric", month: "short", year: "numeric",
  ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
}).format(new Date(date));

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const content = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}
