import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { DevConsoleArt } from "@/components/easter-eggs/dev-console-art";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "World Cup 2026 Predictor",
  description: "Predict every match of the FIFA World Cup 2026 with friends.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          duration={6000}
          style={
            {
              "--normal-bg": "rgba(20, 10, 40, 0.95)",
              "--normal-border": "rgba(142, 91, 254, 0.6)",
              "--normal-text": "#f4f1ff",
              "--width": "440px",
            } as React.CSSProperties
          }
          toastOptions={{
            style: {
              fontSize: "15px",
              lineHeight: "1.4",
              padding: "18px 20px",
              minHeight: "64px",
              boxShadow: "0 20px 60px -20px rgba(142, 91, 254, 0.55)",
            },
          }}
        />
        <DevConsoleArt />
      </body>
    </html>
  );
}
