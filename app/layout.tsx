import "@/styles/globals.css";

import { Metadata } from "next";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ChatProvider } from "@/lib/chat-context";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

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
      <body
        className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
        suppressHydrationWarning
      >
        <Providers>
          <ChatProvider>
            <Toaster position="top-center" richColors />
            {/*             <GridPattern
              width={50}
              height={50}
              x={-1}
              y={-1}
              strokeDasharray={"4 2"}
              className={cn(
                "[mask-image:radial-gradient(50vw_40vh_at_center,white,transparent)]"
              )}
              gradientFrom="var(--accent-100)"
              gradientVia="hsl(from var(--fg-100) h s l / 0.1)"
              gradientTo="var(--accent-100)"
              gradientDegrees={90}
            /> */}
            {children}
          </ChatProvider>
        </Providers>
      </body>
    </html>
  );
}
