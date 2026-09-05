"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Send } from "lucide-react";

export default function SupportMessageForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submitSupportMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("sending");
    setError("");

    const formData = new FormData(form);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        contact: String(formData.get("contact") ?? ""),
        topic: "technical",
        message: String(formData.get("message") ?? ""),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Message failed to send. Please try again.");
      setStatus("error");
      return;
    }

    form.reset();
    setStatus("sent");
  }

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={submitSupportMessage}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#9ca3af]">
            Name
          </label>
          <input
            required
            name="name"
            type="text"
            placeholder="Your name"
            className="w-full border border-[#1f1f1f] bg-black/35 px-4 py-3 text-white outline-none transition placeholder:text-stone-600 focus:border-[#b11226]"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#9ca3af]">
            WeChat or Email
          </label>
          <input
            required
            name="contact"
            type="text"
            placeholder="WeChat ID or email"
            className="w-full border border-[#1f1f1f] bg-black/35 px-4 py-3 text-white outline-none transition placeholder:text-stone-600 focus:border-[#b11226]"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#9ca3af]">
          Question
        </label>
        <textarea
          required
          name="message"
          rows={5}
          placeholder="Tell us what went wrong or what you need help with..."
          className="w-full resize-none border border-[#1f1f1f] bg-black/35 px-4 py-3 text-white outline-none transition placeholder:text-stone-600 focus:border-[#b11226]"
        />
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex items-center justify-center gap-2 bg-[#b11226] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#d11a2a] disabled:cursor-not-allowed disabled:opacity-60 [clip-path:polygon(0_0,94%_0,100%_28%,100%_100%,6%_100%,0_72%)]"
      >
        {status === "sending" ? "Sending..." : "Leave a Message"}
        <Send size={17} />
      </button>

      {status === "sent" && (
        <p className="border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-3 text-sm leading-6 text-[#9ca3af]">
          Message sent. An ECL admin will review it from the admin inbox.
        </p>
      )}

      {status === "error" && (
        <p className="border border-[#b11226]/40 bg-[#b11226]/10 px-4 py-3 text-sm leading-6 text-red-200">
          {error}
        </p>
      )}
    </form>
  );
}
