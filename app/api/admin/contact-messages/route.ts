import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        contact: true,
        topic: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("GET /api/admin/contact-messages error:", error);

    return NextResponse.json(
      { error: "Failed to fetch contact messages" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";
    const status = body.status === "resolved" ? "resolved" : "new";

    if (!id) {
      return NextResponse.json({ error: "Message id is required" }, { status: 400 });
    }

    const message = await prisma.contactMessage.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        status: true,
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("PATCH /api/admin/contact-messages error:", error);

    return NextResponse.json(
      { error: "Failed to update contact message" },
      { status: 500 },
    );
  }
}
