import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "nodeCore Channel UI",
  description: "Channel UI for nodeCore",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
