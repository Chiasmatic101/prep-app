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
  title: "Chiasmatic | AI-Driven Sleep & Cognitive Optimization",
  description: "Revolutionizing human potential through AI-driven sleep optimization, cognitive testing, and personalized performance insights.",
  keywords: ["sleep optimization", "cognitive enhancement", "AI coaching", "performance tracking", "brain training"],
  authors: [{ name: "Chiasmatic Team" }],
  creator: "Chiasmatic",
  publisher: "Chiasmatic",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Chiasmatic | AI-Driven Sleep & Cognitive Optimization",
    description: "Think Smarter. Sleep Deeper. Perform Better.",
    url: "https://yourdomain.com", // Replace with actual domain
    siteName: "Chiasmatic",
    images: [
      {
        url: "/images/og-image.png", // Add this image to your /public/images folder
        width: 1200,
        height: 630,
        alt: "Chiasmatic Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chiasmatic | AI-Driven Sleep & Cognitive Optimization",
    description: "Think Smarter. Sleep Deeper. Perform Better.",
    images: ["/images/og-image.png"],
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}