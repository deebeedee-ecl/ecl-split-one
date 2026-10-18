import { MetadataRoute } from "next";
import { newsPosts } from "@/lib/news-posts";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://eclchina.lol/news",
      lastModified: new Date(newsPosts[0].publishedAt),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...newsPosts.map((post) => ({
      url: `https://eclchina.lol/news/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: "https://eclchina.lol",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://eclchina.lol/teams",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://eclchina.lol/free-agents",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://eclchina.lol/schedule",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: "https://eclchina.lol/results",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: "https://eclchina.lol/standings",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: "https://eclchina.lol/stats",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: "https://eclchina.lol/format",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: "https://eclchina.lol/rules",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://eclchina.lol/contact",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
