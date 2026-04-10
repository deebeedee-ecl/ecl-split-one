"use client";

import { useEffect, useRef, useState } from "react";
import { X, Volume2, SkipForward } from "lucide-react";

const STORAGE_KEY = "ecl_splash_video_dismissed";

export default function SplashVideo() {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [hasStartedWithSound, setHasStartedWithSound] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    setIsOpen(!dismissed);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, "true");

    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handleVideoEnd = () => {
    handleClose();
  };

  const handlePlayWithSound = async () => {
    if (!videoRef.current) return;

    try {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
      await videoRef.current.play();
      setHasStartedWithSound(true);
    } catch (error) {
      console.error("Unable to play with sound:", error);
    }
  };

  if (isOpen !== true) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
      <div className="relative w-full max-w-3xl">
        <div className="absolute -top-14 right-0 z-20 flex items-center gap-3">
          <button
            onClick={handleClose}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/65 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
          >
            <SkipForward className="h-4 w-4" />
            Skip Intro
          </button>

          <button
            onClick={handleClose}
            aria-label="Close splash video"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white transition hover:border-emerald-400 hover:text-emerald-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
          <video
            ref={videoRef}
            className="h-auto max-h-[70vh] w-full object-contain bg-black"
            autoPlay
            muted
            playsInline
            controls
            preload="auto"
            onEnded={handleVideoEnd}
          >
            <source src="/video/Hype.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>

          <div className="flex flex-col gap-3 border-t border-white/10 bg-neutral-950/95 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
                ECL Split One
              </p>
              <p className="text-sm text-neutral-300">
                Enter the league. Seize. Your. Moment.
              </p>
            </div>

            <div className="flex gap-3">
              {!hasStartedWithSound && (
                <button
                  onClick={handlePlayWithSound}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
                >
                  <Volume2 className="h-4 w-4" />
                  Play with Sound
                </button>
              )}

              <button
                onClick={handleClose}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/5"
              >
                Enter Site
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}