import type { Metadata, Viewport } from "next";
import { getSettings } from "@/lib/db";
import { SITE_URL } from "@/lib/cms";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: s.site?.name ?? "Bridge and Value",
    // Google Search Console verification tag carried over from WordPress (editable in Settings).
    verification: s.seo?.googleVerification ? { google: s.seo.googleVerification } : undefined,
    icons: {
      icon: [
        { url: "/wp-content/uploads/2024/01/cropped-FAVICON-32x32.png", sizes: "32x32" },
        { url: "/wp-content/uploads/2024/01/cropped-FAVICON-192x192.png", sizes: "192x192" },
      ],
      apple: "/wp-content/uploads/2024/01/cropped-FAVICON-180x180.png",
    },
    other: { "msapplication-TileImage": "/wp-content/uploads/2024/01/cropped-FAVICON-270x270.png" },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US">
      <body>{children}</body>
    </html>
  );
}
