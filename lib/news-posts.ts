import content from "./news-posts.json";

export type NewsBlock =
  | { kind: "heading" | "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] };
export type NewsPost = { slug: string; title: string; category: string; summary: string; publishedAt: string; dateLabel: string; status: string; blocks: NewsBlock[] };
export const newsPosts = content as NewsPost[];
export const findNewsPost = (slug: string) => newsPosts.find(post => post.slug === slug);
