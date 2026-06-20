import { NextResponse } from "next/server";
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
        createdAt: true,
      },
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
