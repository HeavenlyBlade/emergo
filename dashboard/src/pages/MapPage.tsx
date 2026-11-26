/**
 * MapPage  EModule 6: Dashboard Live Map
 *
 * Uses Leaflet + OpenStreetMap  Ecompletely free, no API key needed.
 *
 * Real-time Firestore listener on incidents collection.
 * Status-differentiated pins:
 *   - unverified: amber/pulsing
 *   - verified: green/solid
 *   - resolved: gray
 *
 * Clicking a pin opens the incident detail panel.
 *
 * Emergency alarm: when a genuinely NEW unverified incident arrives after
 * page mount, a looping alarm plays and a modal appears.
 * Multiple alerts are queued; each must be Responded to or Dismissed
 * before the next is shown. Auto-dismisses after 5 minutes.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useIncidents } from '../hooks/useIncidents';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../hooks/useAuth';
import { useAlarmSound } from '../hooks/useAlarmSound';
import type { IncidentDocument } from '../types';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_BG,
  formatRelativeTime,
  calculateDistanceMeters,
  formatDistance,
} from '../utils/incidentUtils';
import IncidentDetailPanel from '../components/IncidentDetailPanel';
import Sidebar from '../components/Sidebar';
import { AlertTriangle, Eye, EyeOff, Radio } from 'lucide-react';

interface TanodLocation {
  uid: string;
  latitude: number;
  longitude: number;
  lastSeen?: { toDate: () => Date };
  displayName: string;
  isVisible?: boolean;
  status?: 'available' | 'on_the_way';
  activeIncidentId?: string | null;
}

// Center on Barangay Marketview, Lucena City
const DEFAULT_CENTER: [number, number] = [13.9374, 121.6175];
const DEFAULT_ZOOM = 15;

const AUTO_DISMISS_MS = 5 * 60 * 1000; // 5 minutes

// Auto-fly to newly selected incident
function MapFlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 17, { duration: 1 });
  }, [coords, map]);
  return null;
}

export default function MapPage() {
  const { incidents, newIncidents } = useIncidents();
  const { usersMap } = useUsers();
  const { uid, userDoc } = useAuth();
  const [selected, setSelected] = useState<IncidentDocument | null>(null);
  const [tanodLocations, setTanodLocations] = useState<TanodLocation[]>([]);
  const [revealResponders, setRevealResponders] = useState(true);

  // ── Alarm & modal state ──────────────────────────────────────────────
  const { startAlarm, stopAlarm } = useAlarmSound();
  const [alertQueue, setAlertQueue] = useState<IncidentDocument[]>([]);

  // ── Responder / Tanod location listener ──────────────────────────────
  useEffect(() => {
    if (!userDoc || (userDoc.role !== 'official' && userDoc.role !== 'admin' && userDoc.role !== 'responder')) return;

    // Listen to responder_locations
    const unsubResponders = onSnapshot(collection(db, 'responder_locations'), (snapshot) => {
      const now = new Date().getTime();
      const locations = snapshot.docs
        .map((d) => ({ uid: d.id, ...d.data() } as TanodLocation))
        .filter(
          (loc) =>
            loc.isVisible !== false &&
            (!loc.lastSeen || now - loc.lastSeen.toDate().getTime() < 10 * 60 * 1000)
        );
      
      setTanodLocations((prev) => {
        const merged = new Map<string, TanodLocation>();
        prev.forEach((p) => merged.set(p.uid, p));
        locations.forEach((l) => merged.set(l.uid, l));
        return Array.from(merged.values());
      });
    });

    // Listen to tanod_locations for backward compatibility
    const unsubTanods = onSnapshot(collection(db, 'tanod_locations'), (snapshot) => {
      const now = new Date().getTime();
      const locations = snapshot.docs
        .map((d) => ({ uid: d.id, ...d.data() } as TanodLocation))
        .filter(
          (loc) =>
            loc.isVisible !== false &&
            (!loc.lastSeen || now - loc.lastSeen.toDate().getTime() < 10 * 60 * 1000)
        );
      setTanodLocations((prev) => {
        const merged = new Map<string, TanodLocation>();
        prev.forEach((p) => merged.set(p.uid, p));
        locations.forEach((l) => merged.set(l.uid, l));
        return Array.from(merged.values());
      });
    });

    return () => {
      unsubResponders();
      unsubTanods();
    };
  }, [userDoc?.role]);

  // Nearest responders to selected incident
  const respondersNearSelected = useMemo(() => {
    if (!selected?.location) return [];
    return tanodLocations
      .map((r) => {
        const distanceMeters = calculateDistanceMeters(
          selected.location.latitude,
          selected.location.longitude,
          r.latitude,
          r.longitude
        );
        return { ...r, distanceMeters };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [selected, tanodLocations]);

  // ── New-incident detector ────────────────────────────────────────────
  useEffect(() => {
    if (newIncidents.length > 0) {
      setAlertQueue((prev) => [...prev, ...newIncidents]);
    }
  }, [newIncidents]);

  // ── Start / stop alarm when queue head changes ───────────────────────
  const currentAlert = alertQueue[0] ?? null;

  useEffect(() => {
    if (currentAlert) {
      startAlarm();
    } else {
      stopAlarm();
    }
  }, [currentAlert?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-dismiss after 5 minutes ────────────────────────────────────
  const dismissFirst = useCallback(() => {
    stopAlarm();
    setAlertQueue((prev) => prev.slice(1));
  }, [stopAlarm]);

  useEffect(() => {
    if (!currentAlert) return;
    const timer = setTimeout(dismissFirst, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [currentAlert?.id, dismissFirst]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Modal action handlers ────────────────────────────────────────────
  const handleRespond = useCallback(
    (incident: IncidentDocument) => {
      stopAlarm();
      setAlertQueue((prev) => prev.slice(1));
      setSelected(incident);
    },
    [stopAlarm]
  );

  const handleDismiss = useCallback(() => {
    stopAlarm();
    setAlertQueue((prev) => prev.slice(1));
  }, [stopAlarm]);

  const selectedCoords: [number, number] | null = selected?.location
    ? [selected.location.latitude, selected.location.longitude]
    : null;

  return (
    <div className="flex h-screen">
      <Sidebar active="map" userDoc={userDoc} />

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Live Map</h1>
            <p className="text-sm text-gray-500">
              {incidents.filter(i => i.status === 'unverified').length} unverified ·{' '}
              {incidents.filter(i => i.status === 'verified').length} verified ·{' '}
              {incidents.filter(i => i.status === 'resolved').length} resolved
            </p>
          </div>
          {/* Controls & Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-600">
            {/* Toggle to reveal responders */}
            <button
              onClick={() => setRevealResponders((v) => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all border ${
                revealResponders
                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                  : 'bg-gray-100 border-gray-300 text-gray-500'
              }`}
              title="Toggle responder locations on map"
            >
              {revealResponders ? <Eye size={15} /> : <EyeOff size={15} />}
              <span>{revealResponders ? 'Responders Visible' : 'Responders Hidden'}</span>
              <span className="bg-blue-600 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full">
                {tanodLocations.length}
              </span>
            </button>

            <div className="hidden lg:flex gap-3">
              {(Object.entries(STATUS_LABELS) as [keyof typeof STATUS_COLORS, string][]).map(
                ([status, label]) => (
                  <span key={status} className="flex items-center gap-1">
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: STATUS_COLORS[status] }}
                    />
                    {label}
                  </span>
                )
              )}
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#1D4ED8' }} />
                Responder (live)
              </span>
            </div>
          </div>
        </div>

        {/* Map + detail panel row */}
        <div className="flex flex-1 overflow-hidden min-h-0 relative">
          {/* Nearby responders banner when an incident is selected */}
          {selected && respondersNearSelected.length > 0 && revealResponders && (
            <div className="absolute top-3 left-14 z-1000 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-blue-200 px-4 py-2.5 max-w-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
                <span className="text-xs font-bold text-gray-800">
                  Responders Near This Emergency ({respondersNearSelected.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {respondersNearSelected.slice(0, 3).map((r) => (
                  <span
                    key={r.uid}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-medium ${
                      r.status === 'on_the_way'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-blue-50 text-blue-800 border border-blue-200'
                    }`}
                  >
                    <span>{r.displayName}</span>
                    <span className="font-mono font-bold text-[11px] text-blue-700">
                      {formatDistance(r.distanceMeters)}
                    </span>
                    {r.status === 'on_the_way' && (
                      <span className="text-[10px] bg-amber-500 text-white font-bold px-1 rounded">On the way</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Map */}
          <div className="flex-1 relative min-h-0 min-w-0">
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              style={{ width: '100%', height: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapFlyTo coords={selectedCoords} />

              {incidents.map((incident) => {
                const lat = incident.location?.latitude;
                const lng = incident.location?.longitude;
                if (!lat || !lng) return null;

                const color = STATUS_COLORS[incident.status];
                const isSelected = selected?.id === incident.id;

                return (
                  <CircleMarker
                    key={incident.id}
                    center={[lat, lng]}
                    radius={isSelected ? 14 : 10}
                    pathOptions={{
                      color: isSelected ? '#111' : color,
                      fillColor: color,
                      fillOpacity: incident.status === 'resolved' ? 0.4 : 0.85,
                      weight: isSelected ? 3 : 2,
                    }}
                    eventHandlers={{
                      click: () => setSelected(incident),
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">{STATUS_LABELS[incident.status]}</p>
                        <p className="text-gray-500 text-xs">
                          {formatRelativeTime(incident.reportedAt)}
                        </p>
                        <p className="text-gray-500 text-xs">
                          Reported by: {usersMap[incident.reportedBy] ?? incident.reportedBy}
                        </p>
                        {incident.description && (
                          <p className="mt-1">{incident.description}</p>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

              {revealResponders &&
                tanodLocations.map((tanod) => {
                  const dist = selected?.location
                    ? calculateDistanceMeters(
                        selected.location.latitude,
                        selected.location.longitude,
                        tanod.latitude,
                        tanod.longitude
                      )
                    : null;
                  const isOnTheWay = tanod.status === 'on_the_way';

                  return (
                    <CircleMarker
                      key={`tanod-${tanod.uid}`}
                      center={[tanod.latitude, tanod.longitude]}
                      radius={isOnTheWay ? 10 : 8}
                      pathOptions={{
                        color: isOnTheWay ? '#D97706' : '#1D4ED8',
                        fillColor: isOnTheWay ? '#F59E0B' : '#2563EB',
                        fillOpacity: 0.9,
                        weight: 2,
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <div className="flex items-center gap-1.5 font-semibold text-blue-700 mb-0.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block animate-ping" />
                            <span>Responder (live)</span>
                          </div>
                          <p className="font-bold text-gray-800">{tanod.displayName}</p>
                          <p className="text-xs text-gray-500 capitalize">
                            Status: <span className="font-medium text-gray-700">{isOnTheWay ? 'On the way' : 'Available'}</span>
                          </p>
                          {dist !== null && (
                            <p className="text-xs font-semibold text-blue-700 mt-1">
                              Distance to selected emergency: {formatDistance(dist)}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
            </MapContainer>
          </div>

          {/* Detail panel */}
          {selected && (
            <IncidentDetailPanel
              incident={selected}
              uid={uid!}
              userRole={userDoc?.role ?? 'resident'}
              onClose={() => setSelected(null)}
              isPanel
              usersMap={usersMap}
            />
          )}
        </div>
      </div>

      {/* ── Emergency Alert Modal ─────────────────────────────────────── */}
      {currentAlert && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            {/* Title row */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">New Emergency Alert</h2>
            </div>

            {/* Severity badge */}
            <span
              className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-3 ${STATUS_BG[currentAlert.status]}`}
            >
              {STATUS_LABELS[currentAlert.status]}
              {currentAlert.severity ? ` · ${currentAlert.severity.charAt(0).toUpperCase() + currentAlert.severity.slice(1)}` : ''}
            </span>

            {/* Description */}
            <p className="text-gray-700 text-sm mb-2">
              {currentAlert.description || 'No description'}
            </p>

            {/* Relative time */}
            <p className="text-gray-400 text-xs mb-6">
              {formatRelativeTime(currentAlert.reportedAt)}
            </p>

            {/* Queue indicator */}
            {alertQueue.length > 1 && (
              <p className="text-amber-600 text-xs font-medium mb-4">
                +{alertQueue.length - 1} more alert{alertQueue.length - 1 > 1 ? 's' : ''} waiting
              </p>
            )}

            {/* Actions */}
            <button
              onClick={() => handleRespond(currentAlert)}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Respond
            </button>
            <button
              onClick={handleDismiss}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg mt-2 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
