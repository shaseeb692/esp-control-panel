import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MasterThemeProvider } from "@/components/theme/MasterThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Phantom Smart Homes",
  description: "Control and automate your smart home with Phantom Smart Homes | secure device management, real-time controls, smart schedules, and seamless home automation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta
          name="strix-verification"
          content="strix-verify-45e3265dfbcb62d522c0919115c58f04"
        />
      </head>

      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col antialiased`}
      >
        <MasterThemeProvider>
          {children}
        </MasterThemeProvider>
      </body>
    </html>
  );
}