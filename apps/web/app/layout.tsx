import type { Metadata } from "next";

import { AppNav } from "./components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "PivotalEdge",
  description: "Clinical-regulatory probability intelligence",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
