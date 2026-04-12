import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

async function createLeagueWireItem(formData: FormData) {
  "use server";

  const text = String(formData.get("text") || "").trim();
  const hrefValue = String(formData.get("href") || "").trim();
  const sortOrderValue = String(formData.get("sortOrder") || "0").trim();

  if (!text) return;

  await prisma.leagueWireItem.create({
    data: {
      text,
      href: hrefValue || null,
      sortOrder: Number(sortOrderValue) || 0,
      isVisible: true,
    },
  });

  revalidatePath("/admin/league-wire");
  revalidatePath("/");
}

async function deleteLeagueWireItem(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");

  if (!id) return;

  await prisma.leagueWireItem.delete({
    where: { id },
  });

  revalidatePath("/admin/league-wire");
  revalidatePath("/");
}

async function toggleLeagueWireVisibility(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  const currentValue = String(formData.get("currentValue") || "true");

  if (!id) return;

  await prisma.leagueWireItem.update({
    where: { id },
    data: {
      isVisible: currentValue !== "true",
    },
  });

  revalidatePath("/admin/league-wire");
  revalidatePath("/");
}

export default async function LeagueWireAdminPage() {
  const items = await prisma.leagueWireItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:text-green-400"
        >
          ← Back to Dashboard
        </Link>

        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
            Admin Panel
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">
            League Wire
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/60">
            Add flexible homepage updates for Split One. Keep it simple: just
            text, optional link, and display order.
          </p>
        </div>

        <div className="mb-10 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <h2 className="mb-5 text-2xl font-bold">Add New Item</h2>

          <form action={createLeagueWireItem} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">
                Headline Text
              </label>
              <textarea
                name="text"
                required
                rows={3}
                placeholder="e.g. MFG defeat ZAF 2-0 in the opening series of Split One"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">
                Optional Link
              </label>
              <input
                name="href"
                type="text"
                placeholder="/schedule or https://..."
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">
                Sort Order
              </label>
              <input
                name="sortOrder"
                type="number"
                defaultValue={0}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-green-400/50"
              />
            </div>

            <button
              type="submit"
              className="rounded-2xl border border-green-400/30 bg-green-500/15 px-5 py-3 font-semibold text-green-300 transition hover:border-green-400/50 hover:bg-green-500/20"
            >
              Add League Wire Item
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Current Items</h2>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/50">
              {items.length} total
            </span>
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center text-white/50">
              No League Wire items yet.
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-5"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                        item.isVisible
                          ? "border border-green-400/30 bg-green-500/15 text-green-300"
                          : "border border-red-400/30 bg-red-500/15 text-red-300"
                      }`}
                    >
                      {item.isVisible ? "Visible" : "Hidden"}
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/50">
                      Sort: {item.sortOrder}
                    </span>
                  </div>

                  <p className="mb-3 text-base leading-relaxed text-white">
                    {item.text}
                  </p>

                  {item.href && (
                    <p className="mb-4 break-all text-sm text-green-300/80">
                      {item.href}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <form action={toggleLeagueWireVisibility}>
                      <input type="hidden" name="id" value={item.id} />
                      <input
                        type="hidden"
                        name="currentValue"
                        value={String(item.isVisible)}
                      />
                      <button
                        type="submit"
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-green-400/40 hover:text-white"
                      >
                        {item.isVisible ? "Hide" : "Show"}
                      </button>
                    </form>

                    <form action={deleteLeagueWireItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:border-red-400/40 hover:bg-red-500/15"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}