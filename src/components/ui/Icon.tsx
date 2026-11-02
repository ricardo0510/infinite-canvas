import type { ReactNode, SVGProps } from "react";

const PATHS = {
  logo: (
    <>
      <path d="M9 7.4 14.4 6.2M9.3 8.2l5.2 8.6" />
      <circle cx="7" cy="7" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="6" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="18" r="2.2" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H10" />
    </>
  ),
  redo: (
    <>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H14" />
    </>
  ),
  download: <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14" />,
  upload: <path d="M12 21V9m0 0 5 5m-5-5-5 5M5 3h14" />,
  command: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.2a2.6 2.6 0 1 1 4.3 2c-.8.7-1.9 1.1-1.9 2.3" />
      <path d="M12 17.4h.01" />
    </>
  ),
  "zoom-in": (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5M10.5 7.5v6M7.5 10.5h6" />
    </>
  ),
  "zoom-out": (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5M7.5 10.5h6" />
    </>
  ),
  layout: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  magnet: (
    <>
      <path d="M6 4v7a6 6 0 0 0 12 0V4h-4v7a2 2 0 0 1-4 0V4z" />
      <path d="M6 8h4M14 8h4" />
    </>
  ),
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  map: (
    <>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  "align-left": <path d="M4 4v16M8 8h12M8 16h8" />,
  "align-center-x": <path d="M12 4v16M6 8h12M8 16h8" />,
  "align-right": <path d="M20 4v16M4 8h12M8 16h8" />,
  "align-top": <path d="M4 4h16M8 8v12M16 8v8" />,
  "align-center-y": <path d="M4 12h16M8 6v12M16 8v8" />,
  "align-bottom": <path d="M4 20h16M8 4v12M16 8v8" />,
  "distribute-x": (
    <>
      <path d="M4 4v16M20 4v16" />
      <path d="M9 7h6v10H9z" />
    </>
  ),
  "distribute-y": (
    <>
      <path d="M4 4h16M4 20h16" />
      <path d="M7 9h10v6H7z" />
    </>
  ),
  group: <path d="M4 8h10v10H4zM8 4h12v12H8z" />,
  ungroup: <path d="M4 4h6v6H4zM14 14h6v6h-6z" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  "file-text": (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h4" />
    </>
  ),
  folder: (
    <>
      <path d="M3 6h6l2 2h10v11H3z" />
      <path d="M3 6v13" />
    </>
  ),
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m4 17 4.5-4.5 3 3L15 12l5 5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  fullscreen: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  check: <path d="m4 12 5 5L20 6" />,
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  "arrow-right": <path d="M4 12h15m-6-6 6 6-6 6" />,
  sparkles: (
    <>
      <path d="M12 3.5 13.6 8l4.4 1.6L13.6 11 12 15.5 10.4 11 6 9.6 10.4 8z" />
      <path d="M18 14.5 18.8 17l2.2.8-2.2.8L18 21l-.8-2.4L15 17.8l2.2-.8z" />
    </>
  ),
  bot: (
    <>
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 4v4M8.5 13h.01M15.5 13h.01M9 16h6" />
    </>
  ),
  send: <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  size?: number;
};

export function Icon({ name, size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
