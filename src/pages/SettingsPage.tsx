import { useState } from "react";
import { Building2, UsersRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import OutletsPanel from "@/components/OutletsPanel";
import EmployeesPanel from "@/components/EmployeesPanel";

type Tab = "outlets" | "employees";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("outlets");
  const { data: session } = useAuth();
  if (!session) return null;
  return <div className="page-container settings-page">
    <header className="page-heading"><div><span className="section-kicker">ADMINISTRASI TOKO</span><h1>Outlet & karyawan</h1><p>Atur cabang dan akses tim untuk {session.store.name}.</p></div></header>
    <div className="settings-tabs" role="tablist" aria-label="Pengaturan toko">
      <button role="tab" aria-selected={tab === "outlets"} className={tab === "outlets" ? "active" : ""} onClick={() => setTab("outlets")}><Building2 size={18} /> Outlet <span>{session.outlets.length}</span></button>
      <button role="tab" aria-selected={tab === "employees"} className={tab === "employees" ? "active" : ""} onClick={() => setTab("employees")}><UsersRound size={18} /> Karyawan</button>
    </div>
    {tab === "outlets" ? <OutletsPanel /> : <EmployeesPanel />}
  </div>;
}
