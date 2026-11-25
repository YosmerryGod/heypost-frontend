import { Store } from "lucide-react";
import OutletsPanel from "@/components/OutletsPanel";

export default function OutletsPage() {
  return <div className="page-container settings-page">
    <header className="page-heading">
      <div>
        <span className="section-kicker">MANAJEMEN CABANG</span>
        <h1>Outlet</h1>
        <p>Kelola cabang, alamat, dan outlet aktif untuk toko Anda.</p>
      </div>
      <Store size={24} aria-hidden="true" />
    </header>
    <OutletsPanel />
  </div>;
}
