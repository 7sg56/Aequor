import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aequor | AI-Verified Freelance Payments on Solana",
  description:
    "Multi-agent work verification and conditional payment streaming for freelancers. Powered by AI evidence audits and Solana blockchain.",
  keywords: ["solana", "freelance", "payments", "AI verification", "escrow", "blockchain"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} dark`}
    >
      <body>{children}</body>
    </html>
  );
}
