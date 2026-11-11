import type { Metadata } from "next";
import "./globals.css";

// Helvetica Neue only, as in enzi-ws. No webfont — system stack.
export const metadata: Metadata = {
  title: "Enzi Timer",
  description: "Enzi Timer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen bg-white text-slate-900 antialiased selection:bg-bsi-100 selection:text-bsi-900">
        {children}
      </body>
    </html>
  );
}
