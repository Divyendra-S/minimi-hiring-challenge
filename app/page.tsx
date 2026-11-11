import { Suspense } from "react";
import { App } from "@/components/App";

// useSearchParams needs a Suspense boundary so the rest of the page can be prerendered.
export default function Page() {
  return (
    <Suspense>
      <App />
    </Suspense>
  );
}
