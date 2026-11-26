import { Building2, CreditCard, Printer, ReceiptText, Settings, UsersRound } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";

// [ADDED] Pusat navigasi pengaturan toko dan perangkat.

type SettingsItem = {
  label: string;
  description: string;
  icon: typeof Building2;
  to?: string;
};

const settingsGroups: { title: string; items: SettingsItem[] }[] = [
  {
    title: "TOKO",
    items: [
      { label: "Outlet", description: "Kelola cabang dan alamat toko", icon: Building2, to: "/outlet" },
      { label: "Karyawan", description: "Kelola akun dan hak akses tim", icon: UsersRound, to: "/karyawan" },
    ],
  },
  {
    title: "TRANSAKSI",
    items: [
      { label: "Pengaturan Struk", description: "Identitas toko dan format struk", icon: ReceiptText },
      { label: "Printer", description: "Koneksi printer dan ukuran kertas", icon: Printer },
      { label: "Pembayaran", description: "Metode pembayaran yang diterima", icon: CreditCard },
    ],
  },
  {
    title: "APLIKASI",
    items: [
      { label: "Preferensi", description: "Pengaturan dan perilaku aplikasi", icon: Settings },
    ],
  },
];

export default function SettingsPage() {
  const { data: session } = useAuth();
  if (!session) return null;

  return <div className="page-container settings-page settings-hub">
    <header className="page-heading">
      <div>
        <span className="section-kicker">PREFERENSI TOKO</span>
        <h1>Pengaturan</h1>
        <p>Kelola operasional {session.store.name} dalam satu tempat.</p>
      </div>
    </header>
    {settingsGroups.map((group) => <section className="settings-hub-group" key={group.title}>
      <h2>{group.title}</h2>
      <div className="settings-hub-list">
        {group.items.map(({ label, description, icon: Icon, to }) => {
          const content = <>
            <span className="settings-hub-icon"><Icon size={20} /></span>
            <span className="settings-hub-copy"><strong>{label}</strong><small>{description}</small></span>
            {to ? <span className="settings-hub-arrow" aria-hidden="true">›</span> : <span className="settings-hub-soon">Segera</span>}
          </>;
          return to
            ? <Link className="settings-hub-row" key={label} to={to}>{content}</Link>
            : <div className="settings-hub-row is-disabled" key={label} aria-disabled="true">{content}</div>;
        })}
      </div>
    </section>)}
  </div>;
}
