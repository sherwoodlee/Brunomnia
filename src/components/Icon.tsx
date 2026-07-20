import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'archive'
  | 'braces'
  | 'check'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-up'
  | 'clock'
  | 'code'
  | 'copy'
  | 'cube'
  | 'database'
  | 'download'
  | 'folder'
  | 'globe'
  | 'grid'
  | 'history'
  | 'import'
  | 'lock'
  | 'pin'
  | 'play'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'settings'
  | 'spark'
  | 'trash'
  | 'x';

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icon({ name, size = 18, ...props }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  const content: Record<IconName, ReactNode> = {
    archive: <><path d="M4 7h16v12H4z" /><path d="M3 4h18v3H3zM9 11h6" /></>,
    braces: <><path d="M8 3H6.8A1.8 1.8 0 0 0 5 4.8v4.1c0 1.6-.7 2.6-2 3.1 1.3.5 2 1.5 2 3.1v4.1A1.8 1.8 0 0 0 6.8 21H8" /><path d="M16 3h1.2A1.8 1.8 0 0 1 19 4.8v4.1c0 1.6.7 2.6 2 3.1-1.3.5-2 1.5-2 3.1v4.1a1.8 1.8 0 0 1-1.8 1.8H16" /></>,
    check: <path d="m5 12 4.5 4.5L19 7" />,
    'chevron-down': <path d="m7 9 5 5 5-5" />,
    'chevron-right': <path d="m9 7 5 5-5 5" />,
    'chevron-up': <path d="m7 14 5-5 5 5" />,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
    code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    cube: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
    database: <><ellipse cx="12" cy="5" rx="7.5" ry="3" /><path d="M4.5 5v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5M4.5 12v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-7" /></>,
    download: <><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" /><path d="M5 20h14" /></>,
    folder: <path d="M3.5 6.5h6l2 2h9v10h-17z" />,
    globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.1 2.3 3.2 5.2 3.2 8.5s-1.1 6.2-3.2 8.5c-2.1-2.3-3.2-5.2-3.2-8.5S9.9 5.8 12 3.5Z" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><rect x="14" y="14" width="6" height="6" /></>,
    history: <><path d="M4 7v5h5" /><path d="M5.3 17.5A8.5 8.5 0 1 0 4 8" /><path d="M12 7v5l3 2" /></>,
    import: <><path d="M12 21V9M7.5 13.5 12 9l4.5 4.5" /><path d="M5 4h14" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" /></>,
    pin: <><path d="m8 4 8 8M9.5 2.5l12 12M14 10l-5 5M6 18l-3 3" /><path d="m8 4-3 5 10 10 5-3" /></>,
    play: <path d="m8 5 11 7-11 7z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 8.2A7.5 7.5 0 0 1 18.7 7L20 12M4 12l1.3 5a7.5 7.5 0 0 0 12.6-1.2" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2.1-.7a7 7 0 0 0-.6-1.5l1-2-2.1-2.1-2 1a7 7 0 0 0-1.5-.6L10.5 2h-3l-.7 2.1a7 7 0 0 0-1.5.6l-2-1-2.1 2.1 1 2a7 7 0 0 0-.6 1.5L0 10.5v3l2.1.7a7 7 0 0 0 .6 1.5l-1 2 2.1 2.1 2-1a7 7 0 0 0 1.5.6l.7 2.1h3l.7-2.1a7 7 0 0 0 1.5-.6l2 1 2.1-2.1-1-2a7 7 0 0 0 .6-1.5z" transform="translate(1.5 .25) scale(.88)" /></>,
    spark: <><path d="m12 3 1.3 4.2L17.5 9l-4.2 1.8L12 15l-1.3-4.2L6.5 9l4.2-1.8z" /><path d="m18.5 15 .6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z" /></>,
    trash: <><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>,
    x: <path d="m6 6 12 12M18 6 6 18" />,
  };

  return <svg {...common} {...props}>{content[name]}</svg>;
}
