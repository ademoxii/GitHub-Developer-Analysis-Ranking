import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShellScope — GitHub Developer Analysis",
  description: "Import GitHub accounts and compare developers against your project criteria with ShellScope.",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
