import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/contracts/appRouter";
import { trpc } from "@/providers/trpc";

export type AuthSession = NonNullable<inferRouterOutputs<AppRouter>["auth"]["me"]>;
export type Role = AuthSession["principal"]["role"];

export function useAuth() {
  return trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });
}
