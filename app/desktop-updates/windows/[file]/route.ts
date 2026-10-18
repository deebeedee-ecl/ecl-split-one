import { desktopUpdateTarget } from "@/lib/desktop-update-host";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const target = desktopUpdateTarget(file, process.env.ECL_DESKTOP_UPDATE_BLOB_BASE);
  if (!target) return new Response("Update file unavailable", { status: 404, headers: { "Cache-Control": "no-store" } });
  // Redirect the binary transfer; never stream a large installer through a Vercel Function.
  return new Response(null, { status: 307, headers: { Location: target, "Cache-Control": "no-store" } });
}
