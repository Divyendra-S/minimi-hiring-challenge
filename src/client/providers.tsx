"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // useState keeps one client for the lifetime of the page instead of one per render.
  const [client] = useState(
    () =>
      // Sessions and messages only change when this page sends a message, and it invalidates
      // them right after, so there is no reason to refetch on mount or window focus.
      new QueryClient({ defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
