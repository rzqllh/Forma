import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "FORMA | Finishing Visual",
  description:
    "Single-user finishing workspace for interior design photography: strip metadata, watermark with client presets, resize/compress, and preview color adjustments.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex flex-col pb-24 sm:pb-28">{children}</main>
      </body>
    </html>
  );
}
