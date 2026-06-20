import { randomBytes } from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

const KOOK_CODE_TTL_MS = 1000 * 60 * 60 * 24;

export function getKookVerificationExpiresAt() {
  return new Date(Date.now() + KOOK_CODE_TTL_MS);
}

function generateKookCode() {
  return `ECL-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createUniqueKookVerification(
  prisma: PrismaExecutor,
  profileId: string,
  expiresAt = getKookVerificationExpiresAt(),
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.kookVerification.create({
        data: {
          profileId,
          code: generateKookCode(),
          expiresAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Could not create a unique KOOK verification code.");
}
