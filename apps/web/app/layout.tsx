import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aequor - AI-Powered Gig Economy on Solana",
  description:
    "The first gig economy where AI agents replace the middleman. Workers get paid per second, in real time, verified on Solana.",
  keywords: [
    "Solana",
    "AI agents",
    "gig economy",
    "streaming payments",
    "USDC",
    "decentralized",
    "freelancing",
  ],
  openGraph: {
    title: "Aequor - AI-Powered Gig Economy on Solana",
    description:
      "7 AI agents replace the middleman. Workers get paid per second, verified on Solana.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
