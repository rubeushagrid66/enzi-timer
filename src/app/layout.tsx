import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Enzi Timer — Focus, beautifully timed",
  description: "A minimalist timer. Pick an activity, press start, stay with it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-zinc-50 text-zinc-900 min-h-screen">{children}</body>
    </html>
  );
}
