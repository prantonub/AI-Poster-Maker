import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Political Poster Maker",
  description: "Generate ready-to-print political posters in minutes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
