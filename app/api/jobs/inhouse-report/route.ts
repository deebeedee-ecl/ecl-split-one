import { NextResponse } from "next/server";
import {
  claimNextInhouseReportJob,
  completeInhouseReportConfirmationJob,
  completeInhouseReportJob,
  failInhouseReportConfirmationJob,
  failInhouseReportJob,
  retryInhouseReportConfirmationJob,
  unauthorizedReportWorker,
  type ReportJobRawMatchData,
} from "@/lib/inhouse-report-jobs";

export const dynamic = "force-dynamic";
export const preferredRegion = ["sin1", "hkg1", "nrt1", "icn1"];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  if (unauthorizedReportWorker(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const workerId = clean(url.searchParams.get("workerId")) || "report-engine";
  const job = await claimNextInhouseReportJob(workerId);

  return NextResponse.json({
    ok: true,
    job,
  });
}

export async function POST(request: Request) {
  if (unauthorizedReportWorker(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    jobId?: string;
    status?: string;
    rawMatchData?: ReportJobRawMatchData;
    reply?: string;
    error?: string;
  };
  const jobId = clean(body.jobId);
  const status = clean(body.status).toUpperCase();

  if (!jobId) {
    return NextResponse.json(
      { ok: false, message: "jobId is required." },
      { status: 400 },
    );
  }

  try {
    if (status === "FOUND") {
      if (!body.rawMatchData) {
        return NextResponse.json(
          { ok: false, message: "rawMatchData is required when status is FOUND." },
          { status: 400 },
        );
      }

      const result = await completeInhouseReportJob({
        jobId,
        rawMatchData: body.rawMatchData,
        reply: body.reply,
      });

      return NextResponse.json({
        ok: true,
        status: "FOUND",
        responseChannelId: result.job.responseChannelId,
        requestedByKookId: result.job.requestedByKookId,
        sessionId: result.job.sessionId,
        reply: result.reply,
      });
    }

    if (status === "CONFIRMED") {
      const confirmed = await completeInhouseReportConfirmationJob({ jobId });
      return NextResponse.json({
        ok: true,
        status,
        responseChannelId: confirmed.responseChannelId,
        requestedByKookId: confirmed.requestedByKookId,
        sessionId: confirmed.sessionId,
        reply: clean(body.reply) || "The inhouse result was submitted successfully.",
      });
    }

    if (status === "CONFIRM_RETRY") {
      const pending = await retryInhouseReportConfirmationJob({
        jobId,
        error: clean(body.error) || "The report confirmation will be retried.",
      });
      return NextResponse.json({
        ok: true,
        status: "CONFIRM_PENDING",
        responseChannelId: pending.responseChannelId,
        requestedByKookId: pending.requestedByKookId,
        sessionId: pending.sessionId,
      });
    }

    if (status === "CONFIRM_FAILED") {
      const failed = await failInhouseReportConfirmationJob({
        jobId,
        error: clean(body.error) || "The report confirmation failed.",
      });
      return NextResponse.json({
        ok: true,
        status,
        responseChannelId: failed.responseChannelId,
        requestedByKookId: failed.requestedByKookId,
        sessionId: failed.sessionId,
        reply:
          clean(body.reply) ||
          clean(body.error) ||
          "The inhouse result could not be submitted. An admin can retry it from the dashboard.",
      });
    }

    const failed = await failInhouseReportJob({
      jobId,
      error: clean(body.error) || "Report Engine could not find a matching inhouse game.",
    });

    return NextResponse.json({
      ok: true,
      status: "FAILED",
      responseChannelId: failed.responseChannelId,
      requestedByKookId: failed.requestedByKookId,
      sessionId: failed.sessionId,
      reply: clean(body.error) || "I could not find the matching ECL.GG inhouse game yet. Please try !report again later or use the admin dashboard.",
    });
  } catch (error) {
    console.error("POST /api/jobs/inhouse-report error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown report job error.",
      },
      { status: 500 },
    );
  }
}
