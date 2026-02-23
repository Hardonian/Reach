"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface HeroMediaProps {
  videoSrc?: string;
  fallbackSrc: string;
  className?: string;
}

export function HeroMedia({
  videoSrc,
  fallbackSrc,
  className = "",
}: HeroMediaProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // If user prefers reduced motion or video failed to load, show static image
  if (prefersReducedMotion || videoError || !videoSrc) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image
          src={fallbackSrc}
          alt="Hero background"
          fill
          className="object-cover"
          priority
        />
        {/* Overlay for safe text space */}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-r from-background/80 via-transparent to-transparent" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => setVideoError(true)}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
      {/* Overlay for safe text space */}
      <div className="absolute inset-0 bg-linear-to-t from-background via-background/50 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-background/80 via-transparent to-transparent" />
    </div>
  );
}
