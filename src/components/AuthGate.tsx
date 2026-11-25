import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/hooks/useAuth";
import { ErrorState, Loading } from "@/components/Loading";

export function AuthGate({ children }: { children: ReactNode }) {
  const { data, isLoading, error, refetch } = useAuth();
  if (isLoading) return <div className="auth-state"><Loading label="Memeriksa sesi…" /></div>;
  if (error) return <div className="auth-state"><ErrorState message={error.message} retry={() => refetch()} /></div>;
  if (!data) return <Navigate to="/login" replace />;
  return children;
}

export function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { data, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (!data || !allow.includes(data.principal.role)) return <Navigate to="/" replace />;
  return children;
}
