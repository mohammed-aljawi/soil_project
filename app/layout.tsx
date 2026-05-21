import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "./providers";

// Page metadata shown by the browser and search/social previews.
export const metadata: Metadata = {
  title: "Kentucky Mesonet Soil Data Manager",
  description: "Kentucky Mesonet soil record management."
};

// Root layout shared by every page in the Next.js App Router.
export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
