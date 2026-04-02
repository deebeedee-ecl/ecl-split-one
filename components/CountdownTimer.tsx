"use client";

import { useEffect, useState } from "react";

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

function getTimeLeft(): TimeLeft {
  const target = new Date("2026-04-17T23:59:59+08:00").getTime();
  const now = new Date().getTime();
  const difference = target - now;

  if (difference <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: true,
    };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    expired: false,
  };
}

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft());
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft());
      setPulse((prev) => !prev);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (timeLeft.expired) {
    return (
      <div className="overflow-hidden rounded-[2rem] border border-red-400/20 bg-gradient-to-br from-red-500/10 via-zinc-950 to-black p-5 shadow-[0_0_50px_rgba(248,113,113,0.18)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-300 sm:text-sm sm:tracking-[0.35em]">
          Registration Closed
        </p>

        <h2 className="mt-5 break-words text-3xl font-black uppercase leading-none text-white sm:text-4xl md:text-6xl">
          Split One Sign-Ups Have Ended
        </h2>

        <div className="mt-8 h-px w-full bg-gradient-to-r from-transparent via-red-400/50 to-transparent" />

        <p className="mt-8 text-sm leading-7 text-zinc-300 sm:text-base md:text-lg">
          Registration is now closed. Please follow ECL updates for roster
          announcements, scheduling, and the start of Split One.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-[2rem] border border-green-400/20 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 p-5 shadow-[0_0_60px_rgba(74,222,128,0.14)] transition-all duration-500 sm:p-8 ${
        pulse ? "scale-[1.01]" : "scale-100"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="inline-flex w-fit max-w-full items-center gap-3 rounded-full border border-green-400/20 bg-green-400/10 px-4 py-2">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full bg-green-400 shadow-[0_0_18px_rgba(74,222,128,0.9)] transition-all duration-300 ${
              pulse ? "scale-125" : "scale-100"
            }`}
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-green-300 sm:text-xs sm:tracking-[0.25em]">
            Registration Live
          </span>
        </div>

        <div className="w-fit max-w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 sm:text-[11px] sm:tracking-[0.2em]">
          Shanghai Time
        </div>
      </div>

      <h2 className="mt-6 break-words text-3xl font-black uppercase leading-none text-white sm:text-4xl md:text-6xl">
        Time Is Running Out
      </h2>

      <p className="mt-5 text-sm leading-7 text-zinc-300 sm:text-base md:text-lg">
        Registration for ECL Split One closes on{" "}
        <span className="font-semibold text-white">April 17</span>. Lock in your
        roster before the deadline.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <TimeCard value={timeLeft.days} label="Days" pulse={pulse} />
        <TimeCard value={timeLeft.hours} label="Hours" pulse={pulse} />
        <TimeCard value={timeLeft.minutes} label="Minutes" pulse={pulse} />
        <TimeCard value={timeLeft.seconds} label="Seconds" pulse={pulse} highlight />
      </div>

      <div className="mt-8 h-px w-full bg-gradient-to-r from-transparent via-green-400/50 to-transparent" />

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-lg text-sm leading-7 text-zinc-300 md:text-base">
          Teams and free agents must complete registration before the timer
          ends to be considered for Split One.
        </p>

        <div className="inline-flex w-fit max-w-full rounded-full border border-green-400/30 bg-green-400/10 px-5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-green-300 shadow-[0_0_25px_rgba(74,222,128,0.12)] sm:text-sm sm:tracking-[0.2em]">
          Limited Spots
        </div>
      </div>
    </div>
  );
}

function TimeCard({
  value,
  label,
  pulse,
  highlight = false,
}: {
  value: number;
  label: string;
  pulse: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-[1.5rem] border p-4 text-center transition-all duration-300 sm:p-5 ${
        highlight
          ? `border-green-400/25 bg-green-400/10 shadow-[0_0_30px_rgba(74,222,128,0.14)] ${
              pulse ? "scale-[1.03]" : "scale-100"
            }`
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="text-3xl font-black leading-none text-white sm:text-4xl md:text-5xl">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 sm:text-[11px] sm:tracking-[0.22em]">
        {label}
      </div>
    </div>
  );
}