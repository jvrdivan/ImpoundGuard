Frontend brief
Owner's job: explain how the interface is built, why it re-ranks instantly, and why
there is no framework doing it for us.
Everything below cites real files. If you are asked "show me where," open the file.
---
1. What it does
The whole product is one screen. A dark sidebar on the left, and a single scrolling column
on the right holding, in order: KPI cards, a compliance-outlook bar, the risk chart, the
ranked Action Queue, the Certificates register, the Reports pane, and session settings.
The moment a certificate is confirmed, every one of those sections updates at once — and
the Action Queue physically animates the vehicle sliding to its new position. That
animation is the pitch. Everything else supports it.
---
2. How it works
Stack
Three runtime dependencies, total:
Package	Version	Why it's here
`react` / `react-dom`	19.2.8	The UI
`framer-motion`	13.1.0	The re-rank animation, and nothing else
Build is Vite 8. Styling is Tailwind 3.4.19. Linting is `oxlint`. That is the entire
dependency list — see `package.json`.
State: all of it, in one file
Every piece of application state is a plain `useState` in `src/App.jsx:31-45`:
```js
const [fleet, setFleet]         = useState(() => cloneFleet(INITIAL_FLEET));
const [weight, setWeight]       = useState(0.5);   // the MONEY↔LIVES slider
const [mode, setMode]           = useState('risk'); // 'risk' | 'expiry'
const [justUpdatedId, ...]      = useState(null);   // drives the 2.2s flash
const [scanError, ...]          = useState(null);
const [scanPanelOpen, ...]      = useState(false);
const [searchQuery, ...]        = useState('');
```
No Redux, no Zustand, no Context, no reducer. There are five `useRef`s
(`App.jsx:40-44`) but they hold DOM nodes for scrolling, not state.
`cloneFleet` (`App.jsx:27-29`) is a `JSON.parse(JSON.stringify(...))` deep clone, run
before every mutation so React's immutability contract is honoured without pulling in
Immer.
Navigation: there is no router
The six sidebar items don't route anywhere. `handleNavigate` (`App.jsx:95-108`) looks the
key up in a map of refs and calls `scrollIntoView({ behavior: 'smooth' })`. "Overview" has
no ref and falls through to `window.scrollTo({ top: 0 })` (`App.jsx:106`).
Same mechanism powers cross-linking: clicking a notification, a chart dot, or a breakdown
row calls `handleViewVehicle` (`App.jsx:90-93`), which scrolls to the fleet section and
flashes the target row for 2.2 seconds (`flash`, `App.jsx:46-49`).
Styling
Tailwind utility classes written directly in each component. `tailwind.config.js` extends
nothing but a colour palette — `brandNavy`, `brandGold`, `brand` (teal `#0F766E`), plus
semantic `danger` / `warn` / `safe` / `unassessed`. No plugins.
No component library. Every button, badge, menu and tooltip is hand-built markup. Every
icon is an inline `<svg>` function at the bottom of the file that uses it (e.g.
`Sidebar.jsx:68-110`).
One hand-written CSS class exists: `.ig-slider` in `src/index.css:21-63`. It reimplements
the native range input so the hit region is 44px per Apple's HIG while the visible
track stays 6px. It was written because an audit measured the original slider's touch
target at 258×6px — unusable on a trackpad, never mind a phone.
The animation
`framer-motion` appears exactly twice:
`App.jsx:127` — `<MotionConfig reducedMotion="user">` wraps the app, so the OS-level
"Reduce Motion" setting is honoured. framer-motion does not respect this for `layout`
animations on its own.
`ActionQueue.jsx:118-121` — each row is a `motion.div` with `layout`,
`layoutId={vehicle.id}`, and a spring transition (`stiffness: 320, damping: 32`).
That second one is the whole trick. Without `layout`, a React re-render teleports rows to
their new positions instantly and the re-rank is invisible. With it, they slide.
Data flow: scan → screen
"Scan certificate" → `setScanPanelOpen(true)` → modal renders (`App.jsx:192-201`).
User picks a photo → `ScanPanel.handleFile` (`ScanPanel.jsx:35`) → `downscaleImage(file)`
→ base64.
Demo mode (default on): 900ms fake delay, then `DEMO_SCAN_RESULT`. Live mode:
`POST /api/scan`.
Fields populate an editable confirm form. User can correct anything.
"Confirm and apply" → `handleScanConfirmed` (`App.jsx:85-88`) → `applyScanResult`
(`App.jsx:51-71`): clone fleet, match the plate, push the new document, flash the row.
`setFleet` re-renders `App`. `rankFleet(...)` re-runs at `App.jsx:110`, and
`computeFleetStats` / `computeComplianceBuckets` / `pickNextBestActions` / `buildAlerts`
re-derive on lines 111-114. Every panel receives fresh props. The Action Queue animates.
Note lines 110-114 run on every render, unmemoised. With 8 vehicles that is free, and
it removes a whole class of stale-cache bug. Say that plainly if asked.
The components
File	Lines	Role
`RiskPanel.jsx`	280	Hand-drawn SVG revenue-vs-safety quadrant + score breakdown, linked by one shared `hoveredId`
`ReportsPanel.jsx`	229	Forward-looking exposure model, horizon toggle, CSV export
`ActionQueue.jsx`	188	The ranked table, the risk/expiry toggle, the animation
`ScanPanel.jsx`	190	Capture → downscale → extract → confirm → commit
`CertificatesPanel.jsx`	121	Flat register of every document across the fleet
`NextBestAction.jsx`	111	Up to two data-driven suggestions
`NotificationsMenu.jsx`	110	Bell menu, built from the same ranked data
`Sidebar.jsx`	110	Nav, scroll targets
`StatCards.jsx`	97	Four KPI tiles
`TopBar.jsx`	60	Title, date, search, bell, scan CTA
`ComplianceOutlook.jsx`	58	Proportional status bar
`RiskExposurePanel.jsx`	56	The MONEY↔LIVES slider
`Logo.jsx`	52	Inline SVG brandmark
`PrivacyBanner.jsx`	47	POPIA disclosure, expandable
`SessionSettings.jsx`	33	Panic-button scan, clear session
---
3. Why it was built this way
No state library. One screen, one state owner, eight vehicles. A store would add a
concept to explain without removing one.
No router. Every section is on one page by design — an owner should see the whole fleet
without navigating. Scroll-to-section gives the sidebar real behaviour with no route table,
no URL sync, no 404 handling.
No component library. MUI or Chakra would have imposed a look we'd then fight to
override, and shipped far more code than the ~15 controls actually used. Hand-built markup
also means every pixel is explainable.
Deriving instead of caching. `ranked` is recomputed on every render rather than stored.
There is no path where the chart, the KPI cards and the queue can disagree, because they
all read the same freshly-derived array.
---
4. Likely judge questions
"Why no framework for state — doesn't this get messy?"
It would past a certain size. At one screen and eight vehicles, a store is ceremony. State
lives in one file, `App.jsx`, and there are seven values in it — you can read all of them
in ten seconds. When this needs multi-user sync it needs a backend anyway, and that's the
point at which a store earns its place.
"Is the re-sort animation real, or a video?"
Real. It's framer-motion's FLIP `layout` animation on `ActionQueue.jsx:118-121` — React
re-renders the rows in a new order, framer-motion measures before and after and interpolates
between them. Drag the slider and it re-ranks continuously; a video can't do that.
"What happens on a phone?"
It's responsive — the grid collapses to one column at the `lg` breakpoint. The scan flow is
phone-first: `<input type="file" capture="environment">` (`ScanPanel.jsx:126-133`) opens the
rear camera directly. Every control in that flow is at least 44px.
"Accessibility?"
Audited against Apple HIG by measuring the live DOM, not by eye. 11 of 44 text/background
pairs failed WCAG AA and were fixed; the slider's hit region went from 6px to 44px; the
"no action needed" em-dash got an `aria-label` because colour alone can't carry meaning;
and `MotionConfig reducedMotion="user"` respects the OS setting. Dense in-table controls sit
at 36px, which matches Apple's own desktop table guidance.
"Walk me through what happens when I press Confirm."
Use the six-step flow in §2 above. The key beat: nothing goes to a server, `setFleet` fires,
and every panel re-derives from the same array on lines 110-114.
