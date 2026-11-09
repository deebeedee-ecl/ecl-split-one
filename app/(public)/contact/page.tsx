"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
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
        topic: String(formData.get("topic") ?? "general"),
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
    <main className="min-h-screen bg-[#050505] px-4 py-20 text-white sm:px-6">
      <section className="mx-auto max-w-4xl">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
          ECL Support
        </p>
        <h1 className="mt-5 text-[clamp(3.4rem,8vw,7rem)] font-black uppercase leading-[0.9] text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
          Contact Us
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-[#9ca3af]">
          Send us a message about account issues, registration, rules, match
          questions, or general ECL support.
        </p>

        <form
          className="mt-10 border border-[#1f1f1f] bg-[#0d0d0d] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)]"
          onSubmit={submitMessage}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">
                Name
              </span>
              <input
                name="name"
                required
                type="text"
                placeholder="Your name"
                className="w-full border border-[#1f1f1f] bg-black/35 px-4 py-3 text-white outline-none transition placeholder:text-[#6b7280] focus:border-[#b11226]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">
                Contact
              </span>
              <input
                name="contact"
                required
                type="text"
                placeholder="Email, WeChat, or KOOK ID"
                className="w-full border border-[#1f1f1f] bg-black/35 px-4 py-3 text-white outline-none transition placeholder:text-[#6b7280] focus:border-[#b11226]"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">
              Topic
            </span>
            <select
              name="topic"
              required
              className="w-full border border-[#1f1f1f] bg-black/35 px-4 py-3 text-white outline-none transition focus:border-[#b11226]"
            >
              <option value="general">General Question</option>
              <option value="team">Team Registration</option>
              <option value="free-agent">Free Agent Help</option>
              <option value="rules">Rules / Dispute</option>
              <option value="technical">Technical Issue</option>
            </select>
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#6b7280]">
              Message
            </span>
            <textarea
              name="message"
              required
              rows={6}
              placeholder="Write your message here..."
              className="w-full resize-none border border-[#1f1f1f] bg-black/35 px-4 py-3 text-white outline-none transition placeholder:text-[#6b7280] focus:border-[#b11226]"
            />
          </label>

          <button
            type="submit"
            disabled={status === "sending"}
            className="mt-6 inline-flex bg-[#b11226] px-6 py-4 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#d11a2a] disabled:cursor-not-allowed disabled:opacity-60 [clip-path:polygon(0_0,94%_0,100%_28%,100%_100%,6%_100%,0_72%)]"
          >
            {status === "sending" ? "Sending..." : "Send Message"}
          </button>

          {status === "sent" && (
            <p className="mt-5 border border-[#1f1f1f] bg-black/35 px-4 py-3 text-sm font-semibold text-[#c6cbd3]">
              Message sent. An ECL admin will review it.
            </p>
          )}

          {status === "error" && (
            <p className="mt-5 border border-[#b11226]/40 bg-[#b11226]/10 px-4 py-3 text-sm font-semibold text-red-200">
              {error}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
