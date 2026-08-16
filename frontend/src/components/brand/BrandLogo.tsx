import { useId } from 'react';

export interface BrandLogoProps {
  markSize?: number;
  wordmarkClassName?: string;
}

/**
 * Logo Tâm Đặng dùng monogram TD nguyên bản. Mỗi instance có id SVG riêng để
 * gradient và shadow không xung đột khi header, footer cùng xuất hiện.
 */
export function BrandLogo({
  markSize = 34,
  wordmarkClassName = 'text-lg',
}: Readonly<BrandLogoProps>) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gradientId = `td-logo-gradient-${instanceId}`;
  const shadowId = `td-logo-shadow-${instanceId}`;

  return (
    <span className="inline-flex shrink-0 items-center gap-2" role="img" aria-label="Tâm Đặng">
      <svg
        aria-hidden="true"
        width={markSize}
        height={markSize}
        viewBox="0 0 48 48"
        fill="none"
        className="shrink-0 overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="9" y1="5" x2="39" y2="43" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF7A1A" />
            <stop offset="1" stopColor="#F4511E" />
          </linearGradient>
          <filter id={shadowId} x="-25%" y="-20%" width="150%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#7C2108" floodOpacity="0.3" />
          </filter>
        </defs>

        <g filter={`url(#${shadowId})`}>
          <rect x="4" y="5" width="40" height="40" rx="12" fill="#C83A12" opacity="0.8" />
          <rect
            x="3"
            y="2"
            width="42"
            height="41"
            rx="13"
            fill={`url(#${gradientId})`}
            stroke="#B8320B"
            strokeWidth="1"
          />
          <path
            d="M10 11.5C15.5 5.7 32.2 4.2 38.5 9.4"
            stroke="white"
            strokeOpacity="0.34"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          <g
            stroke="#7C2108"
            strokeOpacity="0.22"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(0 1)"
          >
            <path d="M11.5 15.5H25M18.25 15.5V34" />
            <path d="M27.5 15.5V34M27.5 15.5H30.5C40 15.5 40 34 30.5 34H27.5" />
          </g>
          <g stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11.5 15.5H25M18.25 15.5V34" />
            <path d="M27.5 15.5V34M27.5 15.5H30.5C40 15.5 40 34 30.5 34H27.5" />
          </g>
        </g>
      </svg>

      <span
        aria-hidden="true"
        className={`leading-none font-bold tracking-[-0.03em] whitespace-nowrap uppercase ${wordmarkClassName}`}
      >
        <span className="text-ink">TÂM</span> <span className="text-accent">ĐẶNG</span>
      </span>
    </span>
  );
}
