import { NextResponse } from "next/server";
import {
  defaultEloRuleConfig,
  getEloRuleConfig,
  resetEloRuleConfig,
  setEloRuleConfig,
  type EloRuleConfig,
} from "@/lib/elo-rule-config";

export const dynamic = "force-dynamic";

type EloConfigBody = Partial<EloRuleConfig> & { reset?: boolean };

export async function GET() {
  return NextResponse.json({
    config: getEloRuleConfig(),
    defaults: defaultEloRuleConfig,
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as EloConfigBody | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const next = body.reset ? resetEloRuleConfig() : setEloRuleConfig(body);

  return NextResponse.json({
    config: next,
    defaults: defaultEloRuleConfig,
  });
}
