import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Libre_Baskerville } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Human Lives — Slave Narratives",
  description:
    "Interactive episodes built from firsthand slave narratives. Primary source storytelling that presents enslaved people as fully human.",
  openGraph: {
    title: "Human Lives — Slave Narratives",
    description:
      "Interactive episodes built from firsthand slave narratives.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${libreBaskerville.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
