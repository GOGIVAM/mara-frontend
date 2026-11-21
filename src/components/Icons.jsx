const base = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
  strokeLinecap: 'round', strokeLinejoin: 'round',
};

const Svg = ({ size = 18, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...rest}>{children}</svg>
);

export const Search = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></Svg>
);
export const ChevronDown = (p) => (<Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>);
export const Star = ({ filled, ...p }) => (
  <Svg {...p}>
    <path d="M12 4.5l2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1L4.5 10l5.2-.8L12 4.5z"
      fill={filled ? 'currentColor' : 'none'} />
  </Svg>
);
export const Dots = (p) => (
  <Svg {...p}><circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" /></Svg>
);
export const VideoOff = (p) => (
  <Svg {...p}><path d="M15.5 10.5V8a1.5 1.5 0 0 0-1.5-1.5H8" /><path d="M3.5 6.8A1.5 1.5 0 0 0 3 8v8a1.5 1.5 0 0 0 1.5 1.5H14a1.5 1.5 0 0 0 1.4-1" /><path d="m21 8-4 3v2l4 3V8Z" /><path d="m3 3 18 18" /></Svg>
);
export const Bell = (p) => (
  <Svg {...p}><path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 2.5h15L18 15Z" /><path d="M10 20a2 2 0 0 0 4 0" /></Svg>
);
export const Gear = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="2.8" /><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.3.9 2-3.4-2-1.5Z" /></Svg>
);
export const Plus = (p) => (<Svg {...p}><path d="M12 6v12M6 12h12" /></Svg>);
export const Clip = (p) => (
  <Svg {...p}><path d="M20 11.5 12.4 19a4.5 4.5 0 0 1-6.4-6.4l7.6-7.6a3 3 0 0 1 4.3 4.3l-7.6 7.6a1.5 1.5 0 0 1-2.1-2.1l7-7" /></Svg>
);
export const Send = (p) => (<Svg {...p}><path d="M21 3 10.5 13.5" /><path d="M21 3l-6.8 18-3.7-7.5L3 9.8 21 3Z" /></Svg>);
export const Sparkle = (p) => (
  <Svg {...p}><path d="M12 4.5 13.6 9l4.4 1.6L13.6 12 12 16.5 10.4 12 6 10.6 10.4 9 12 4.5Z" /><path d="M18.5 4v3M20 5.5h-3" /></Svg>
);
export const Reply = (p) => (<Svg {...p}><path d="M9 7 4 12l5 5" /><path d="M4 12h9a6 6 0 0 1 6 6v1" /></Svg>);
export const Tone = (p) => (<Svg {...p}><path d="M6 18V9m6 9V5m6 13v-6" /></Svg>);
export const Clock = (p) => (<Svg {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v4.3l2.7 1.6" /></Svg>);
export const Summary = (p) => (<Svg {...p}><path d="M5 6h14M5 11h14M5 16h8" /></Svg>);
export const Paperclip = Clip;
export const Status = (p) => (<Svg {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5" /><circle cx="12" cy="16" r=".6" fill="currentColor" /></Svg>);
export const Cube = (p) => (
  <Svg {...p}><path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" /><path d="m4 8 8 4.5L20 8M12 12.5V20" /></Svg>
);
export const Wrench = (p) => (
  <Svg {...p}><path d="M15.5 4.5a5 5 0 0 0-6.2 6.2L4 16v4h4l5.3-5.3a5 5 0 0 0 6.2-6.2l-3 3-2.8-2.8 3-3Z" /></Svg>
);
export const Chart = (p) => (<Svg {...p}><path d="M4 20h16" /><path d="M7 20v-6m5 6V6m5 14v-9" /></Svg>);
export const Grid = (p) => (
  <Svg {...p}><rect x="4" y="4" width="7" height="7" rx="1.6" /><rect x="13" y="4" width="7" height="7" rx="1.6" /><rect x="4" y="13" width="7" height="7" rx="1.6" /><rect x="13" y="13" width="7" height="7" rx="1.6" /></Svg>
);
export const Chat = (p) => (
  <Svg {...p}><path d="M20 12.5A6.5 6.5 0 0 1 13.5 19H8l-4 2.5V12.5A6.5 6.5 0 0 1 10.5 6h3A6.5 6.5 0 0 1 20 12.5Z" /></Svg>
);
export const Signal = (p) => (<Svg {...p}><path d="M12 20V9" /><circle cx="12" cy="6" r="2.5" /><path d="M8 20h8" /></Svg>);
export const Offline = (p) => (
  <Svg {...p}><path d="M5 12.5a4 4 0 0 1 3.6-4A5.5 5.5 0 0 1 19 9.6 3.5 3.5 0 0 1 18.6 16H8a3.5 3.5 0 0 1-3-3.5Z" /><path d="m3 3 18 18" /></Svg>
);
/** Logo CAMRAIL (public/logo1.png)  utilisé dans la barre supérieure et à la connexion. */
export const Logo = ({ height = 26, className = 'brand-logo' }) => (
  <img src="/logo1.png" alt="CAMRAIL" className={className} style={{ height }} />
);
