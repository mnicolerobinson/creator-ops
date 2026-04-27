import type { Metadata } from "next";
import { Bebas_Neue, Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.creatrops.com"),
  title: "CreatrOps — Your Brand Deals. Finally Running Themselves.",
  description:
    "A dedicated ops team that handles every brand inquiry, manages your deals, and keeps your pipeline moving — so you can focus on creating.",
  openGraph: {
    type: "website",
    title: "CreatrOps — Your Brand Deals. Finally Running Themselves.",
    description:
      "A dedicated ops team that handles every brand inquiry, manages your deals, and keeps your pipeline moving.",
    url: "https://app.creatrops.com",
    siteName: "CreatrOps",
    images: [
      {
        url: "https://app.creatrops.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "CreatrOps",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CreatrOps — Your Brand Deals. Finally Running Themselves.",
    description:
      "A dedicated ops team that handles every brand inquiry, manages your deals, and keeps your pipeline moving.",
    images: ["https://app.creatrops.com/og-image.png"],
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
      className={`${montserrat.variable} ${cormorant.variable} ${bebas.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
