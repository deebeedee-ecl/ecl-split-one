"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import styles from "./split-ii.module.css";

export default function DashboardAudio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let disposed = false;
    audio.volume = 0.2;
    void audio.play().then(() => { if (!disposed) setPlaying(true); }).catch(() => {
      // Browsers may require a user gesture before allowing audible playback.
      if (!disposed) setPlaying(false);
    });
    return () => { disposed = true; audio.pause(); };
  }, []);

  async function toggleMusic() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.muted = true; setPlaying(false); return; }
    audio.muted = false;
    try { await audio.play(); setPlaying(true); } catch { setPlaying(false); }
  }

  return (
    <>
      <audio ref={audioRef} src="/split-ii-champ-select.mp3" loop preload="none" onError={() => setFailed(true)} />
      <button type="button" className={styles.musicButton} onClick={() => void toggleMusic()} disabled={failed}
        aria-pressed={playing} aria-label={failed ? "Dashboard music unavailable" : playing ? "Mute dashboard music" : "Play dashboard music"}
        title={failed ? "Music unavailable" : playing ? "Mute music" : "Play music"}>
        {playing ? <Volume2 size={15} /> : <VolumeX size={15} />}<span>{failed ? "Music unavailable" : playing ? "Music on" : "Play music"}</span>
      </button>
    </>
  );
}
