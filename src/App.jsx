// src/App.jsx
//
// Dashboard shell. Holds all state — there is no backend to sync with, the
// fleet lives in memory for the session and nowhere else. Scans (real or
// simulated) mutate it; the risk engine re-derives the ranking on every
// render; framer-motion animates the reorder in ActionQueue.

import { useState, useCallback, useRef } from 'react';
import { MotionConfig } from 'framer-motion';
import { INITIAL_FLEET, DEMO_SCAN_RESULT, findVehicleByPlate } from './data/fleet';
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

function cloneFleet(fleet) {
  return JSON.parse(JSON.stringify(fleet));
}

export default function App() {
  const [fleet, setFleet] = useState(() => cloneFleet(INITIAL_FLEET));
  const [weight, setWeight] = useState(0.5);
  const [mode, setMode] = useState('risk');
  const [justUpdatedId, setJustUpdatedId] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanPanelOpen, setScanPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fleetRef = useRef(null);
  const certificatesRef = useRef(null);
  const riskRef = useRef(null);
  const reportsRef = useRef(null);
  const settingsRef = useRef(null);

  const flash = (id) => {
    setJustUpdatedId(id);
    setTimeout(() => setJustUpdatedId((cur) => (cur === id ? null : cur)), 2200);
  };

  const applyScanResult = useCallback((scanResult) => {
    setScanError(null);
    setFleet((prev) => {
      const next = cloneFleet(prev);
      const matched = findVehicleByPlate(next, scanResult.plate);
      if (!matched) {
        setScanError(`No vehicle on file matches plate "${scanResult.plate}".`);
        return prev;
      }
      matched.documents.push({
        type: scanResult.docType,
        docNumber: scanResult.docNumber,
        holderName: scanResult.holderName,
        issueDate: scanResult.issueDate,
        expiryDate: scanResult.expiryDate,
        verified: true,
      });
      flash(matched.id);
      return next;
    });
  }, []);

  const handleSimulateScan = () => applyScanResult(DEMO_SCAN_RESULT);

  const handleClearSession = () => {
    setFleet(cloneFleet(INITIAL_FLEET));
    setWeight(0.5);
    setMode('risk');
    setJustUpdatedId(null);
    setScanError(null);
    setScanPanelOpen(false);
    setSearchQuery('');
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
          <SessionSettings onSimulateScan={handleSimulateScan} onClearSession={handleClearSession} />
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
