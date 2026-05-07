import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emily & Hang's Chatroom",
  description: "A live chatroom for Emily and Hang.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#fff1f6]">{children}</body>
    </html>
  );
}
