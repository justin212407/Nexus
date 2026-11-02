import React from "react";
const paths = {
  inbox: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M4 14h5l2 3h2l2-3h5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M8 15v-4m5 4V7m5 8V4" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6m-5 0v7L4 20h16l-6-10V3M7 15h10" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  down: <path d="m6 9 6 6 6-6" />,
  arrow: (
    <>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </>
  ),
  back: (
    <>
      <path d="M20 12H4m6-6-6 6 6 6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z" />
    </>
  ),
  evidence: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6m-6 4h3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 6 9 7 9-7" />
    </>
  ),
  send: (
    <>
      <path d="m21 3-7 18-4-7-7-4zM10 14 21 3" />
    </>
  ),
  slack: (
    <>
      <path d="M9 3v18m6-18v18M3 9h18M3 15h18" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3c2 1 3 3 3 6" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="3" width="18" height="7" rx="2" />
      <rect x="3" y="14" width="18" height="7" rx="2" />
      <path d="M7 6.5h.01M7 17.5h.01" />
    </>
  ),
  warning: (
    <>
      <path d="m12 3 10 18H2zM12 9v5m0 3h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10h.01" />
    </>
  ),
  branch: (
    <>
      <circle cx="7" cy="5" r="2" />
      <circle cx="7" cy="19" r="2" />
      <circle cx="17" cy="5" r="2" />
      <path d="M7 7v10m10-10c0 7-10 3-10 8" />
    </>
  ),
  code: (
    <>
      <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-5-15-2 18" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" />
    </>
  ),
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" />
    </>
  ),
  filter: (
    <>
      <path d="M4 7h16M7 12h10m-7 5h4" />
    </>
  ),
};
export default function Icon({ name, size = 18, className = "", ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`icon ${className}`}
      {...props}
    >
      {paths[name] || paths.info}
    </svg>
  );
}
export function Logo() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 28 28" width="28" height="28">
        <path
          d="M5 21V7h5l8 14h5V7h-5v14L10 7H5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
