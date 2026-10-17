import { getAccountFromRequest } from "@/lib/account-auth";
import { prisma } from "@/lib/prisma";
import { createRegistrationHandlers } from "@/lib/tournaments/registration-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = createRegistrationHandlers(prisma, getAccountFromRequest);
export const GET = handlers.GET;
export const POST = handlers.POST;