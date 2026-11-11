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
    <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      {children}
    </p>
  );
}
