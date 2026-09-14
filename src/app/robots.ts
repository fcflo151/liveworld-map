import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://liveworld-map.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/health"],
      disallow: ["/api/", "/api/scanner", "/api/osint/"],
      crawlDelay: 10,
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
