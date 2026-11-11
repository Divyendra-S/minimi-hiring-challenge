import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Health, ImportStatus, SessionSummary, StoredMessage } from "@/shared/dto";

export const queryKeys = {
  health: ["health"] as const,
  sessions: ["sessions"] as const,
  importStatus: ["import"] as const,
  messages: (sessionId: string) => ["messages", sessionId] as const,
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json() as Promise<T>;
}

export function useHealth() {
  // staleTime 0: refetch on window focus, so the notice clears once keys are added to .env.
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => getJson<Health>("/api/health"),
    staleTime: 0,
  });
}

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: () => getJson<SessionSummary[]>("/api/sessions"),
  });
}

export function useLoadDemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok) throw new Error(`/api/demo returned ${res.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}

/** Uploads a JSON file of past chats. The server's message says what is wrong with a bad file. */
export function useImportChats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: await file.text(),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `/api/import returned ${res.status}`);
      return body as { chats: number; turns: number };
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
        queryClient.invalidateQueries({ queryKey: queryKeys.importStatus }),
      ]),
  });
}

/** Turns still waiting for memory extraction. Polled only while there are some. */
export function useImportStatus() {
  return useQuery({
    queryKey: queryKeys.importStatus,
    queryFn: () => getJson<ImportStatus>("/api/import"),
    refetchInterval: (query) => (query.state.data?.pending ? 2000 : false),
  });
}

export function useMessages(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.messages(sessionId ?? ""),
    queryFn: () => getJson<StoredMessage[]>(`/api/sessions/${sessionId}/messages`),
    enabled: sessionId !== null,
  });
}
