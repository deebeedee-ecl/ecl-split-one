import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { newsPosts, findNewsPost } from "@/lib/news-posts";

export function generateStaticParams() { return newsPosts.map(post => ({ slug: post.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = findNewsPost((await params).slug);
  return post ? { title: `${post.title} | ECL`, description: post.summary } : {};
}
function Inline({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") ? <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong> : part);
}
export default async function NewsArticle({ params }: { params: Promise<{ slug: string }> }) {
  const post = findNewsPost((await params).slug);
  if (!post) notFound();
  return <main className="min-h-screen bg-[#080a0f] px-5 py-12 text-white sm:py-16"><article className="mx-auto max-w-3xl">
    <Link href="/news" className="text-sm font-semibold text-blue-300 hover:text-blue-200">← All ECL news</Link>
    <header className="mt-8 border-b border-white/10 pb-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">{post.category} · {post.status}</p><h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">{post.title}</h1><time dateTime={post.publishedAt} className="mt-5 block text-sm text-slate-400">{post.dateLabel}</time><p className="mt-6 text-lg leading-8 text-slate-300">{post.summary}</p></header>
    <div className="pb-8">{post.blocks.map((block, index) => {
      if (block.kind === "heading") return <h2 key={index} className="mb-4 mt-10 text-2xl font-bold text-white">{block.text}</h2>;
      if (block.kind === "paragraph") return <p key={index} className="my-5 leading-8 text-slate-300"><Inline text={block.text} /></p>;
      if (block.kind === "list") {
        const Tag = block.ordered ? "ol" : "ul";
        return <Tag key={index} className={`my-5 space-y-3 pl-6 leading-8 text-slate-300 ${block.ordered ? "list-decimal" : "list-disc"}`}>{block.items.map((item, row) => <li key={row}><Inline text={item} /></li>)}</Tag>;
      }
      if (block.kind === "table") return <div key={index} className="my-6 overflow-x-auto rounded-lg border border-white/10"><table className="w-full text-left text-sm"><thead className="bg-white/5 text-white"><tr>{block.headers.map((cell, column) => <th key={column} className="px-4 py-3 font-semibold">{cell}</th>)}</tr></thead><tbody className="text-slate-300">{block.rows.map((row, line) => <tr key={line} className="border-t border-white/10">{row.map((cell, column) => <td key={column} className="px-4 py-3 leading-7"><Inline text={cell} /></td>)}</tr>)}</tbody></table></div>;
    })}</div>
    <footer className="flex flex-wrap gap-4 border-t border-white/10 pt-6"><Link href="/news" className="rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold">More ECL news</Link><Link href="/hub/dashboard" className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold">Open ECL Hub</Link><Link href={`/news/${post.slug === "patch-2-2" ? "meet-ecl-hub" : "patch-2-2"}`} className="px-4 py-3 text-sm text-blue-300">{post.slug === "patch-2-2" ? "Meet the desktop app →" : "Read Patch 2.2 →"}</Link></footer>
  </article></main>;
}
