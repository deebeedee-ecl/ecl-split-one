"use client";

import { useEffect, useState } from "react";

const TARGET_DATE = "2026-04-20T20:00:00+08:00";

type TimeLeft = {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getTimeLeft(target: string): TimeLeft {
  const now = new Date().getTime();
  const targetTime = new Date(target).getTime();
  const total = targetTime - now;

  if (total <= 0) {
    return {
      total: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
  };
}

const EMPTY_TIME: TimeLeft = {
  total: 1,
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
};

export default function CountdownTimer() {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(EMPTY_TIME);

  useEffect(() => {
    setMounted(true);
    setTimeLeft(getTimeLeft(TARGET_DATE));

    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(TARGET_DATE));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const isStarted = mounted && timeLeft.total <= 0;

  return (
    <div className="mt-10">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">
        Split Starts In
      </p>

      <div className="inline-flex items-center gap-5 rounded-xl border border-green-400/30 bg-gradient-to-r from-zinc-900 via-black to-zinc-900 px-6 py-3 backdrop-blur-md shadow-[0_0_25px_rgba(74,222,128,0.15)]">
        {isStarted ? (
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-green-300">
            League Live
          </span>
        ) : (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />

            <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-green-400">
              Countdown
            </span>

            <Divider />

            <div className="flex items-center gap-4">
              <TimeUnit value={timeLeft.days} label="D" />
              <Divider />
              <TimeUnit value={timeLeft.hours} label="H" />
              <Divider />
              <TimeUnit value={timeLeft.minutes} label="M" />
              <Divider />
              <TimeUnit value={timeLeft.seconds} label="S" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-lg font-black text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.2)]">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-green-400">
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-4 w-px bg-white/10" />;
}