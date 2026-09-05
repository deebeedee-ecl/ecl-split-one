import { NextResponse } from "next/server";
import { notifyKookAdmins } from "@/lib/kook-notifier";
import { prisma } from "@/lib/prisma";

const TOPICS = new Set([
  "general",
  "team",
  "free-agent",
  "rules",
  "community",
  "technical",
]);

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatKookAdminMessage(message: {
  id: string;
  name: string;
  contact: string;
  topic: string;
  body: string;
  createdAt: Date;
}) {
  const adminUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")}/admin#messages`
    : "/admin#messages";

  return [
    "**New ECL site message**",
    `**From:** ${message.name}`,
    `**Contact:** ${message.contact}`,
    `**Topic:** ${message.topic}`,
    `**Time:** ${message.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Shanghai" })} CST`,
    `**Admin:** ${adminUrl}`,
    "",
    message.body,
    "",
    `Message ID: ${message.id}`,
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = readString(body.name);
    const contact = readString(body.contact);
    const topic = readString(body.topic) || "general";
    const message = readString(body.message);

    if (!name || !contact || !message) {
      return NextResponse.json(
        { error: "Name, contact, and message are required." },
        { status: 400 },
      );
    }

    if (message.length > 3000) {
      return NextResponse.json(
        { error: "Message is too long. Please keep it under 3000 characters." },
        { status: 400 },
      );
    }

    const saved = await prisma.contactMessage.create({
      data: {
        name: name.slice(0, 120),
        contact: contact.slice(0, 180),
        topic: TOPICS.has(topic) ? topic : "general",
        message,
      },
      select: {
        id: true,
        name: true,
        contact: true,
        topic: true,
        message: true,
        createdAt: true,
      },
    });

    notifyKookAdmins(
      formatKookAdminMessage({
        id: saved.id,
        name: saved.name,
        contact: saved.contact,
        topic: saved.topic,
        body: saved.message,
        createdAt: saved.createdAt,
      }),
    ).catch((error) => {
      console.error("KOOK admin contact notification failed:", error);
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error("POST /api/contact error:", error);

    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 },
    );
  }
}
