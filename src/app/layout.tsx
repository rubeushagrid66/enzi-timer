import type { Metadata } from "next";
import { Playfair_Display, Poppins } from "next/font/google";
import "./globals.css";

// enzi-ws font hierarchy:
// Playfair — display serif, hero only (here: the big countdown + activity name).
// Poppins — standard app typeface, everything else.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Enzi Timer — Focus, beautifully timed",
  description: "A minimalist timer. Pick an activity, press start, stay with it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${poppins.variable}`}>
      <body className="font-sans min-h-screen bg-white text-slate-900 antialiased selection:bg-bsi-100 selection:text-bsi-900">
        {children}
      </body>
    </html>
  );
}
