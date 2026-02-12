import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixelForge | AI-Powered Retro Game Creator",
  description: "Create retro pixel game characters with AI. Describe your hero, generate sprite sheets, preview animations, and export game-ready assets.",
  keywords: ["pixel art", "sprite generator", "retro games", "AI game creator", "pixel character", "sprite sheet", "8-bit", "game assets"],
  authors: [{ name: "PixelForge" }],
  metadataBase: new URL("https://pixelforge.harikp.com"),
  openGraph: {
    title: "PixelForge — AI Pixel Art Game Creator",
    description: "Describe your hero. Get walk, jump, attack & idle sprite sheets. Play in a live sandbox. Export game-ready assets.",
    type: "website",
    siteName: "PixelForge",
    images: [
      {
        url: "/og-banner.jpg",
        width: 1200,
        height: 630,
        alt: "PixelForge — Create retro pixel game characters with AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PixelForge — AI Pixel Art Game Creator",
    description: "Describe your hero. Get sprite sheets. Play in a sandbox. Export assets.",
    images: ["/og-banner.jpg"],
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
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" type="image/png" href="/icon-192.png" sizes="192x192" />
        <link rel="icon" type="image/png" href="/icon-512.png" sizes="512x512" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="antialiased bg-grid">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "PixelForge",
              "url": "https://pixelforge.harikp.com",
              "description": "Create retro pixel game characters with AI. Describe your hero, generate sprite sheets, preview animations, and export game-ready assets.",
              "applicationCategory": "GameApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              }
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
