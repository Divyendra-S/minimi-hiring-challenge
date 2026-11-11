import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/client/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Search Agent",
  description: "A chat agent with web search and memory of past conversations.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
