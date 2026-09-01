import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size?: number) => ({
  width: size ?? 20,
  height: size ?? 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function IconPlay({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M7 4.5v15l13-7.5L7 4.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPause({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="5.5" y="4.5" width="4.6" height="15" rx="1.4" fill="currentColor" stroke="none" />
      <rect x="13.9" y="4.5" width="4.6" height="15" rx="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconRestart({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3.5 8.5A9 9 0 1 1 3 13" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

export function IconHome({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3.5 11 12 3.5 20.5 11" />
      <path d="M6 10v10h12V10" />
    </svg>
  );
}

export function IconSound({ size, muted, ...p }: P & { muted?: boolean }) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4Z" fill="currentColor" stroke="none" />
      {muted ? (
        <>
          <path d="M15.5 9.5 20.5 14.5" />
          <path d="M20.5 9.5 15.5 14.5" />
        </>
      ) : (
        <>
          <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
          <path d="M18 6.5a8 8 0 0 1 0 11" />
        </>
      )}
    </svg>
  );
}

export function IconTrophy({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5.5H4.5a3.5 3.5 0 0 0 3.6 3.5" />
      <path d="M16 5.5h3.5a3.5 3.5 0 0 1-3.6 3.5" />
      <path d="M12 14v3.5" />
      <path d="M8.5 20.5h7" />
    </svg>
  );
}

export function IconBolt({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M13 2.5 4.5 13.5H11L9.5 21.5 19 10h-6.5L13 2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconApple({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M12 7.5c-1-1.6-3-2.2-4.7-1.2C4.9 7.7 4.5 11.4 6.4 15c1.5 2.8 3.4 4.4 4.7 3.6.3-.2.6-.2.9 0 1.3.8 3.2-.8 4.7-3.6 1.9-3.6 1.5-7.3-.9-8.7-1.7-1-3.7-.4-4.7 1.2Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M12 7c0-2 1.2-3.4 3-3.8" />
    </svg>
  );
}

export function IconStar({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1 6.3L12 17.2l-5.5 2.9 1-6.3L3 9.4l6.2-.9L12 2.8Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function IconChevron({ size, dir, ...p }: P & { dir: "up" | "down" | "left" | "right" }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg {...base(size)} {...p} style={{ transform: `rotate(${rot}deg)`, ...p.style }}>
      <path d="m5 14.5 7-7 7 7" />
    </svg>
  );
}

export function LogoSnake({ size = 34, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" {...p}>
      <rect x="3" y="3" width="58" height="58" rx="15" fill="#0d4433" stroke="#2f8f66" strokeWidth="3" />
      <path
        d="M16 42c0-7.7 6.3-13 14-13h5c5.5 0 10-3.6 10-9"
        stroke="#6fe44e"
        strokeWidth="9.5"
        strokeLinecap="round"
      />
      <circle cx="45" cy="18.5" r="6.6" fill="#6fe44e" />
      <circle cx="47.2" cy="16.6" r="1.9" fill="#06251c" />
      <path d="M50.5 21.5 55 24m-4.5-2.5L54 19" stroke="#ff5d5d" strokeWidth="2" strokeLinecap="round" />
      <circle cx="19" cy="47" r="5.4" fill="#ff5d5d" />
      <path d="M19 41.6c0-1.6 1-2.7 2.4-3" stroke="#2fae4f" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
