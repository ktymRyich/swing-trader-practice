import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "スイングトレード練習アプリ",
    description: "過去データで効率的にスイングトレードを学ぶ",
    manifest: "/manifest.json",
    themeColor: "#000000",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Trading Practice",
    },
    viewport: {
        width: "device-width",
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja" className="dark">
            <body className={inter.className}>{children}</body>
        </html>
    );
}
