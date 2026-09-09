"use client";

import { MoonStar } from "lucide-react";

function Cloud({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.5 19H7a5 5 0 1 1 1.1-9.88A6.5 6.5 0 0 1 20 11.5a4 4 0 0 1-2.5 7.5Z" />
    </svg>
  );
}

export function GlobalBackground({
  background,
  skyCss,
  darkMode,
  isNight,
  weatherType,
  backgroundOverlay,
}: {
  background: string;
  skyCss: string;
  darkMode: boolean;
  isNight: boolean;
  weatherType: "clear" | "cloudy" | "rain" | "storm" | "snow";
  backgroundOverlay: string;
}) {

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
        style={{ backgroundImage: `url("${background}")` }}
      />

      <div
        className="absolute inset-0 transition-[background] duration-1000 ease-linear"
        style={{
          background: skyCss,
          opacity: darkMode ? 0.85 : 0.4,
          mixBlendMode: "normal",
        }}
      />

      <div className={`absolute inset-0 transition-all duration-1000 ${backgroundOverlay}`} />

      {isNight && darkMode && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-slate-950/10 to-black/20" />
          <MoonStar className="absolute right-[12%] top-[12%] text-white/80" size={105} />
          <div className="absolute inset-0">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
              <span
                key={star}
                className="absolute h-1 w-1 animate-pulse rounded-full bg-white"
                style={{
                  left: `${8 + star * 8}%`,
                  top: `${7 + (star % 5) * 12}%`,
                  animationDelay: `${star * 300}ms`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {["cloudy", "rain", "storm"].includes(weatherType) && (
        <div className="absolute inset-0 overflow-hidden">
          <Cloud
            className={`absolute -left-40 top-[12%] animate-[cloudMove_38s_linear_infinite] ${
              darkMode ? "text-white/20" : "text-black/10"
            }`}
            size={180}
          />
          <Cloud
            className={`absolute -left-52 top-[32%] animate-[cloudMove_55s_linear_infinite] ${
              darkMode ? "text-white/15" : "text-black/10"
            }`}
            size={250}
          />
          <Cloud
            className={`absolute -right-52 top-[8%] animate-[cloudMoveReverse_46s_linear_infinite] ${
              darkMode ? "text-white/15" : "text-black/10"
            }`}
            size={210}
          />
        </div>
      )}

      {["rain", "storm"].includes(weatherType) && (
        <div className="absolute inset-0 overflow-hidden opacity-45">
          {Array.from({ length: 90 }).map((_, index) => (
            <span
              key={index}
              className={`absolute top-[-30px] h-20 w-px rotate-[15deg] animate-[rainFall_800ms_linear_infinite] ${
                darkMode ? "bg-white/60" : "bg-black/20"
              }`}
              style={{
                left: `${(index * 19) % 100}%`,
                animationDelay: `${(index * 43) % 1000}ms`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
