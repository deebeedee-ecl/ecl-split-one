"use client";

import { useEffect, useState } from "react";

function formatShanghaiTime() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function ShanghaiClock() {
  const [time, setTime] = useState(formatShanghaiTime);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(formatShanghaiTime());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="tabular-nums tracking-[0.06em]">
      {time}
    </span>
  );
}
