import "./globals.css";
import { Metadata } from "next";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import { Inter } from "next/font/google";
import { ChatProvider } from "@/lib/chat-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Computer Use App",
  description: "Control a remote desktop with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          <ChatProvider>
            <Toaster position="top-center" richColors />
            {children}
          </ChatProvider>
        </Providers>
      </body>
    </html>
  );
}
