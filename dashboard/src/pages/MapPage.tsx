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

import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useIncidents } from '../hooks/useIncidents';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../hooks/useAuth';
import { useAlarmSound } from '../hooks/useAlarmSound';
import type { IncidentDocument } from '../types';
import { STATUS_COLORS, STATUS_LABELS, STATUS_BG, formatRelativeTime } from '../utils/incidentUtils';
import IncidentDetailPanel from '../components/IncidentDetailPanel';
import Sidebar from '../components/Sidebar';
import { AlertTriangle } from 'lucide-react';

interface TanodLocation {
  uid: string;
  latitude: number;
  longitude: number;
  lastSeen: { toDate: () => Date };
  displayName: string;
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

  // ── Alarm & modal state ──────────────────────────────────────────────
  const { startAlarm, stopAlarm } = useAlarmSound();
  const [alertQueue, setAlertQueue] = useState<IncidentDocument[]>([]);

  // ── Tanod location listener ──────────────────────────────────────────
  useEffect(() => {
    if (userDoc?.role !== 'official') return;

    const unsub = onSnapshot(collection(db, 'tanod_locations'), (snapshot) => {
      const now = new Date().getTime();
      const locations = snapshot.docs
        .map((d) => ({ uid: d.id, ...d.data() } as TanodLocation))
        .filter(
          (loc) =>
            loc.lastSeen &&
            now - loc.lastSeen.toDate().getTime() < 5 * 60 * 1000
        );
      setTanodLocations(locations);
    });

    return () => unsub();
  }, [userDoc?.role]);

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
          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-600">
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
            {userDoc?.role === 'official' && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#1D4ED8' }} />
                Official (live)
              </span>
            )}
          </div>
        </div>

        {/* Map + detail panel row */}
        <div className="flex flex-1 overflow-hidden min-h-0">
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

              {tanodLocations.map((tanod) => (
                <CircleMarker
                  key={`tanod-${tanod.uid}`}
                  center={[tanod.latitude, tanod.longitude]}
                  radius={8}
                  pathOptions={{
                    color: '#1D4ED8',
                    fillColor: '#1D4ED8',
                    fillOpacity: 0.9,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold text-blue-700">Official (live)</p>
                      <p>{tanod.displayName}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
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
