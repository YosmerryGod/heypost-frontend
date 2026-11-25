import { UsersRound } from "lucide-react";
import EmployeesPanel from "@/components/EmployeesPanel";

export default function EmployeesPage() {
  return <div className="page-container settings-page">
    <header className="page-heading">
      <div>
        <span className="section-kicker">MANAJEMEN TIM</span>
        <h1>Karyawan</h1>
        <p>Kelola akses, role, dan penempatan karyawan di setiap outlet.</p>
      </div>
      <UsersRound size={24} aria-hidden="true" />
    </header>
    <EmployeesPanel />
  </div>;
}
