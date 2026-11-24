import { AlertCircle, LoaderCircle } from "lucide-react";

export function Loading({ label = "Menyiapkan data…" }: { label?: string }) {
  return <div className="state-panel"><LoaderCircle className="spin" size={24} /><p>{label}</p></div>;
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="state-panel error-state"><AlertCircle size={28} /><h2>Data belum dapat dimuat</h2><p>{message}</p><button className="button secondary" onClick={retry}>Coba lagi</button></div>;
}
