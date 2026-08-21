// src/App.jsx
//
// Dashboard shell. The fleet is loaded from Postgres on mount and written
// back when a scan is confirmed; the risk engine re-derives the ranking on
// every render, and framer-motion animates the reorder in ActionQueue.
//
// The server returns the updated fleet in the same response as the write, so
// confirming a scan is one round trip and one state update — the re-rank
// still lands in a single render rather than write-then-refetch.

import { useState, useCallback, useRef, useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { DEMO_SCAN_RESULT } from './data/demoScan';
import { fetchFleet, saveDocument, resetDemoData } from './lib/api';
import { rankFleet } from './lib/risk';
import { computeFleetStats, computeComplianceBuckets, pickNextBestActions, buildAlerts } from './lib/stats';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import PrivacyBanner from './components/PrivacyBanner';
import StatCards from './components/StatCards';
import ComplianceOutlook from './components/ComplianceOutlook';
import RiskExposurePanel from './components/RiskExposurePanel';
import ActionQueue from './components/ActionQueue';
import NextBestAction from './components/NextBestAction';
import RiskPanel from './components/RiskPanel';
import CertificatesPanel from './components/CertificatesPanel';
import ReportsPanel from './components/ReportsPanel';
import SessionSettings from './components/SessionSettings';
import ScanPanel from './components/ScanPanel';

export default function App() {
  const [fleet, setFleet] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState(null);
  const [weight, setWeight] = useState(0.5);
  const [mode, setMode] = useState('risk');
  const [justUpdatedId, setJustUpdatedId] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanPanelOpen, setScanPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const fleetRef = useRef(null);
  const certificatesRef = useRef(null);
  const riskRef = useRef(null);
  const reportsRef = useRef(null);
  const settingsRef = useRef(null);

  // Every state write here happens after the await, never synchronously in
  // the effect body — loadState already starts at 'loading', so setting it
  // again on mount would only cost a cascading render.
  const runLoad = useCallback(async () => {
    try {
      setFleet(await fetchFleet());
      setLoadState('ready');
    } catch (err) {
      setLoadError(err.message);
      setLoadState('error');
    }
  }, []);

  // Fetching the fleet from Postgres is exactly the "synchronising with an
  // external system" case the rule exempts: the state writes happen after the
  // await, and there is nothing to derive during render because the data is
  // not on the client yet.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    runLoad();
  }, [runLoad]);

  const retryLoad = () => {
    setLoadState('loading');
    setLoadError(null);
    runLoad();
  };

  const flash = (id) => {
    setJustUpdatedId(id);
    setTimeout(() => setJustUpdatedId((cur) => (cur === id ? null : cur)), 2200);
  };

  const applyScanResult = useCallback(async (scanResult) => {
    setScanError(null);
    setBusy(true);
    try {
      const { fleet: next, matchedId } = await saveDocument({
        plate: scanResult.plate,
        docType: scanResult.docType,
        holderName: scanResult.holderName,
        docNumber: scanResult.docNumber,
        issueDate: scanResult.issueDate || null,
        expiryDate: scanResult.expiryDate,
      });
      setFleet(next);
      if (matchedId) flash(matchedId);
    } catch (err) {
      setScanError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleSimulateScan = () => applyScanResult(DEMO_SCAN_RESULT);

  const handleResetDemoData = async () => {
    setBusy(true);
    setScanError(null);
    try {
      setFleet(await resetDemoData());
      setWeight(0.5);
      setMode('risk');
      setJustUpdatedId(null);
      setScanPanelOpen(false);
      setSearchQuery('');
    } catch (err) {
      setScanError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleScanConfirmed = (fields) => {
    applyScanResult(fields);
    setScanPanelOpen(false);
  };

  const handleViewVehicle = (id) => {
    fleetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    flash(id);
  };

  const handleNavigate = (key) => {
    const target = {
      fleet: fleetRef,
      certificates: certificatesRef,
      risk: riskRef,
      reports: reportsRef,
      settings: settingsRef,
    }[key];
    if (target?.current) {
      target.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const ranked = rankFleet(fleet, { weight, mode });
  const stats = computeFleetStats(ranked);
  const buckets = computeComplianceBuckets(ranked);
  const { unassessed, topRisk } = pickNextBestActions(ranked);
  const alerts = buildAlerts(ranked);

  const query = searchQuery.trim().toLowerCase();
  const visibleRanked = query
    ? ranked.filter((r) =>
        [r.vehicle.plate, r.vehicle.label, r.vehicle.driverName, r.vehicle.type]
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    : ranked;

  if (loadState !== 'ready') {
    return <FleetGate state={loadState} error={loadError} onRetry={retryLoad} />;
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar onNavigate={handleNavigate} />

      <div className="flex-1 min-w-0 px-4 md:px-8 py-7 space-y-6 max-w-[1680px]">
        <TopBar
          alerts={alerts}
          onViewVehicle={handleViewVehicle}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onScanClick={() => setScanPanelOpen(true)}
        />

        <PrivacyBanner />

        <StatCards stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
          <ComplianceOutlook buckets={buckets} />
          <RiskExposurePanel weight={weight} onWeightChange={setWeight} disabled={mode === 'expiry'} />
        </div>

        <div ref={riskRef} className="scroll-mt-4">
          <RiskPanel ranked={ranked} onViewVehicle={handleViewVehicle} />
        </div>

        {scanError && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {scanError}
          </div>
        )}

        <div ref={fleetRef} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 scroll-mt-4 items-start">
          <ActionQueue
            ranked={visibleRanked}
            mode={mode}
            onModeChange={setMode}
            onScanClick={() => setScanPanelOpen(true)}
            justUpdatedId={justUpdatedId}
          />
          <NextBestAction
            unassessed={unassessed}
            topRisk={topRisk}
            onScanClick={() => setScanPanelOpen(true)}
            onViewVehicle={handleViewVehicle}
          />
        </div>

        <div ref={certificatesRef} className="scroll-mt-4">
          <CertificatesPanel fleet={fleet} onScanClick={() => setScanPanelOpen(true)} />
        </div>

        <div ref={reportsRef} className="scroll-mt-4">
          <ReportsPanel fleet={fleet} ranked={ranked} />
        </div>

        <div ref={settingsRef} className="scroll-mt-4">
          <SessionSettings
            onSimulateScan={handleSimulateScan}
            onResetDemoData={handleResetDemoData}
            busy={busy}
          />
        </div>

        <footer className="text-xs text-slate-500 pt-2 pb-6">
          ImpoundGuard — demo build. Fleet compliance, re-ranked live by real risk.
        </footer>
      </div>

      {scanPanelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setScanPanelOpen(false)}
        >
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <ScanPanel onConfirm={handleScanConfirmed} onClose={() => setScanPanelOpen(false)} />
          </div>
        </div>
      )}
    </div>
    </MotionConfig>
  );
}

/**
 * Shown until the fleet is on screen. A compliance dashboard that renders an
 * empty state on a failed load reads as "nothing is at risk", which is the
 * single most dangerous thing this tool could say by accident — so a failure
 * has to be loud, name the cause, and offer a retry.
 */
function FleetGate({ state, error, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center">
        {state === 'loading' ? (
          <>
            <div className="mx-auto mb-3 h-6 w-6 rounded-full border-2 border-slate-200 border-t-brand animate-spin" />
            <p className="text-sm text-slate-600">Loading fleet…</p>
          </>
        ) : (
          <>
            <h1 className="text-base font-semibold text-slate-900">Could not load the fleet</h1>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <p className="mt-2 text-xs text-slate-500">
              The dashboard is intentionally not shown rather than displaying an empty fleet,
              which would read as “nothing needs attention”.
            </p>
            <button
              onClick={onRetry}
              className="mt-4 rounded-lg bg-brand px-4 h-11 text-sm font-semibold text-white hover:bg-brand/90"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
