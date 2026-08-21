// src/components/Sidebar.jsx
//
// Left nav. Every item is a real scroll target on this single-page
// dashboard — no router, the links just scroll to a section. The
// disabled/"soon" affordance is kept in the markup because it is the
// honest thing to show if a future item ships unfinished; nothing uses
// it today.

import Logo, { Wordmark } from './Logo';

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: HomeIcon, active: true },
  { key: 'fleet', label: 'Fleet', icon: TruckIcon, active: true },
  { key: 'certificates', label: 'Certificates', icon: DocIcon, active: true },
  { key: 'risk', label: 'Risk', icon: RiskIcon, active: true },
  { key: 'schedule', label: 'Schedule', icon: ScheduleIcon, active: true },
  { key: 'reports', label: 'Reports', icon: ReportIcon, active: true },
  { key: 'settings', label: 'Settings', icon: SettingsIcon, active: true },
];

export default function Sidebar({ onNavigate }) {
  return (
    // sticky + self-start pins the sidebar to the viewport as the page
    // scrolls, instead of scrolling away with the (much taller) main
    // column — h-screen + overflow-y-auto is a safety net in case the nav
    // ever grows past a short viewport's height.
    <aside className="hidden md:flex w-56 shrink-0 flex-col bg-brandNavy text-slate-300 h-screen sticky top-0 self-start overflow-y-auto">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <Logo size={30} />
        <Wordmark dark className="text-[15px]" />
      </div>

      <nav className="flex-1 px-3 space-y-0.5 mt-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            disabled={!item.active}
            onClick={() => item.active && onNavigate(item.key)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 h-11 text-sm transition-colors ${
              item.active
                ? 'text-slate-200 hover:bg-white/10 hover:text-white'
                : 'text-slate-400 cursor-default'
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            {!item.active && (
              <span className="text-[10px] rounded-full bg-white/10 px-1.5 py-0.5 text-slate-300">
                soon
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 px-4 py-4 border-t border-white/10">
        <div className="w-9 h-9 rounded-full bg-brandGold text-brandNavy font-bold text-xs flex items-center justify-center shrink-0">
          FM
        </div>
        <div className="leading-tight">
          <div className="text-sm text-white">Fleet Manager</div>
          <div className="text-[11px] text-slate-400">session demo</div>
        </div>
      </div>
    </aside>
  );
}

function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 11l9-7 9 7M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TruckIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 7h11v9H3zM14 11h4l3 3v2h-7zM6.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" strokeLinejoin="round" />
    </svg>
  );
}
function DocIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M7 3h7l4 4v14H7z M14 3v4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function RiskIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 2 2 20h20L12 2zM12 9v5M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ScheduleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}
function ReportIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 19V5M9 19v-8M14 19V9M19 19V4" strokeLinecap="round" />
    </svg>
  );
}
function SettingsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09a1.7 1.7 0 001.55-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34H9a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.55 1z" />
    </svg>
  );
}
