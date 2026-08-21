// src/components/Logo.jsx
//
// The ImpoundGuard brandmark: a shield split navy (left) / gold (right)
// whose negative space reads as a "G", with a perspective road running up
// the centre. Drawn as inline SVG rather than a raster asset so it stays
// crisp at every size and can recolour for the dark sidebar vs light UI.
//
// `Wordmark` renders the full lockup — "Impound" bold, "Guard" lighter,
// matching the brand sheet.

export default function Logo({ size = 32, className = '', mono = false }) {
  const navy = mono ? 'currentColor' : '#1B2A44';
  const gold = mono ? 'currentColor' : '#C9A24B';
  const road = mono ? '#FFFFFF' : '#F7F4EC';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ImpoundGuard"
    >
      {/* Left half of the shield ring — navy */}
      <path
        d="M32 3.5 L5 12 V31.5 C5 46.5 16.5 57.5 32 61.5 L32 52.5 C21.5 49 13.5 41 13.5 31 V18.2 L32 12.4 Z"
        fill={navy}
      />
      {/* Right half of the shield ring — gold */}
      <path
        d="M32 3.5 L59 12 V31.5 C59 46.5 47.5 57.5 32 61.5 L32 52.5 C42.5 49 50.5 41 50.5 31 V18.2 L32 12.4 Z"
        fill={gold}
      />
      {/* Crossbar that closes the "G" */}
      <rect x="35.5" y="26.5" width="15" height="7.5" rx="0.5" fill={gold} />
      {/* Perspective road up the centre */}
      <path d="M32 20 L39.5 52 L32 47.5 L24.5 52 Z" fill={road} />
      <path d="M32 27 L32 44" stroke={navy} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = '', dark = false }) {
  return (
    <span className={`tracking-tight ${dark ? 'text-white' : 'text-brandNavy'} ${className}`}>
      <span className="font-bold">Impound</span>
      <span className="font-medium opacity-90">Guard</span>
    </span>
  );
}
