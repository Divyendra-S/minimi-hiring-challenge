import type { ReactNode } from "react";
import { useHealth } from "@/client/queries";

/** Tells a first-time user what is missing before they try to chat. */
export function SetupNotice() {
  const { data, error } = useHealth();
  if (error) return <Alert>Can't reach the server: {error.message}</Alert>;
  if (!data?.missingEnv.length) return null;
  return (
    <Alert>
      Add {data.missingEnv.join(", ")} to <code>.env</code> (copy <code>.env.example</code>). The
      dev server picks up the change automatically.
    </Alert>
  );
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[13px] leading-relaxed text-amber-800 [&_code]:rounded [&_code]:bg-amber-500/10 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px]"
    >
      {children}
    </p>
  );
}
