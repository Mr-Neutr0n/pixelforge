import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="dark" style={{ background: '#181425' }}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased bg-grid">
        {children}
      </body>
    </html>
  );
}
