import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import AuthGate from "@/components/AuthGate";
import { AuthProvider } from "@/components/AuthProvider";
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
  title: "CRM Casa Corporation",
  description: "CRM Casa Corporation",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const host = headersList.get("host") || "";

  const isValuationPublicDomain = host.includes(
    "valutazioni.holdingcasacorporation.it"
  );

  if (isValuationPublicDomain) {
    return (
      <html lang="it">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          style={{
            margin: 0,
            background: "#111",
            color: "#fff",
          }}
        >
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ margin: 0, background: "#f6f7f9", color: "#111" }}
      >
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}