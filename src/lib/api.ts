const apiOrigin = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export const apiConfig = {
  origin: apiOrigin,
  trpcUrl: apiOrigin ? `${apiOrigin}/api/trpc` : "/api/trpc",
  googleLoginUrl: `${apiOrigin}/api/auth/google/start`,
};
