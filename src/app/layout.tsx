import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PixelForge | AI-Powered Retro Game Creator",
  description: "Create retro pixel games with AI. Describe your game idea and watch it come to life.",
  keywords: ["pixel games", "retro games", "AI game generator", "game creator", "8-bit games"],
  authors: [{ name: "PixelForge" }],
  openGraph: {
    title: "PixelForge | AI-Powered Retro Game Creator",
    description: "Create retro pixel games with AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-grid`}
      >
        {children}
      </body>
    </html>
  );
}
