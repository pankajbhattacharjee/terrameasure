import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
} as const;

export const IconCrosshair = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="6.5" />
    <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconUpload = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 15V4M7 9l5-5 5 5" />
    <path d="M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3" />
  </svg>
);

export const IconFileZip = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 12h.01M12 12h.01M15 12h.01M9 15h.01M12 15h.01" strokeWidth="2.2" />
  </svg>
);

export const IconKml = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" />
    <path d="M14 3v5h5" />
    <circle cx="12" cy="14.5" r="2.4" />
    <path d="M12 12v-1M12 18v-1M9.5 14.5H8.5M15.5 14.5h-1" />
  </svg>
);

export const IconPolygon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3.5 19.5 9l-2.9 8.7H7.4L4.5 9z" />
    <circle cx="12" cy="3.5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="19.5" cy="9" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="16.6" cy="17.7" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="7.4" cy="17.7" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="9" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconLine = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 17.5 9 7.5l4.5 5.5 7-8" />
    <circle cx="3.5" cy="17.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="9" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="13.5" cy="13" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="20.5" cy="5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPoint = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="6.5" strokeDasharray="2.5 3" />
  </svg>
);

export const IconRuler = (p: P) => (
  <svg {...base} {...p}>
    <path d="m3 16.5 13.5-13.5 4.5 4.5L7.5 21 3 16.5z" />
    <path d="m7.5 12 1.8 1.8M10.5 9l1.8 1.8M13.5 6l1.8 1.8" />
  </svg>
);

export const IconGlobe = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.6 2.3 3.9 5.2 3.9 8.5s-1.3 6.2-3.9 8.5c-2.6-2.3-3.9-5.2-3.9-8.5s1.3-6.2 3.9-8.5z" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base} {...p}>
    <path d="m5 13 4 4L19 7" />
  </svg>
);

export const IconAlert = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3.5 22 20H2z" />
    <path d="M12 10v4.5M12 17.4v.1" strokeWidth="2" />
  </svg>
);

export const IconX = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconArrowLeft = (p: P) => (
  <svg {...base} {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const IconChevronRight = (p: P) => (
  <svg {...base} {...p}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconChevronLeft = (p: P) => (
  <svg {...base} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const IconCopy = (p: P) => (
  <svg {...base} {...p}>
    <rect x="9" y="9" width="11" height="11" rx="1.5" />
    <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
  </svg>
);

export const IconSpinner = (p: P) => (
  <svg {...base} {...p} className={`animate-spin ${p.className ?? ""}`}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

export const IconLayers = (p: P) => (
  <svg {...base} {...p}>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m4.5 12.5 7.5 4.2 7.5-4.2" />
    <path d="m4.5 16.5 7.5 4.2 7.5-4.2" />
  </svg>
);

export const IconDatabase = (p: P) => (
  <svg {...base} {...p}>
    <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
    <path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13" />
    <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
  </svg>
);

export const IconActivity = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 12h4l2.5-7 5 14 2.5-7H21" />
  </svg>
);

export const IconBraces = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 4c-2 0-3 1-3 3v2c0 1.5-.8 2.5-2 3 1.2.5 2 1.5 2 3v2c0 2 1 3 3 3" />
    <path d="M16 4c2 0 3 1 3 3v2c0 1.5.8 2.5 2 3-1.2.5-2 1.5-2 3v2c0 2-1 3-3 3" />
  </svg>
);
