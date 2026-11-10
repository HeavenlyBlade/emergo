/**
 * MapPage  EModule 6: Dashboard Live Map
 *
 * Uses Leaflet + OpenStreetMap  Ecompletely free, no API key needed.
 *
 * Real-time Firestore listener on incidents collection.
 * Status-differentiated pins:
 *   - unverified: amber/pulsing
 *   - verified: green/solid
 *   - resolved: gray
 *
 * Clicking a pin opens the incident detail panel.
 */

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../hooks/useAuth';
import type { IncidentDocument } from '../types';
import { STATUS_COLORS, STATUS_LABELS, formatRelativeTime } from '../utils/incidentUtils';
import IncidentDetailPanel from '../components/IncidentDetailPanel';
import Sidebar from '../components/Sidebar';

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

// Auto-fly to newly selected incident
function MapFlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 17, { duration: 1 });
  }, [coords, map]);
  return null;
}

export default function MapPage() {
  const { incidents } = useIncidents();
  const { uid, userDoc } = useAuth();
  const [selected, setSelected] = useState<IncidentDocument | null>(null);
  const [tanodLocations, setTanodLocations] = useState<TanodLocation[]>([]);

  useEffect(() => {
    if (userDoc?.role !== 'official' && userDoc?.role !== 'tanod') return;

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
            {(userDoc?.role === 'official' || userDoc?.role === 'tanod') && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#1D4ED8' }} />
                Tanod
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
                      <p className="font-semibold text-blue-700">🔵 Tanod</p>
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
              userRole={userDoc?.role ?? 'tanod'}
              onClose={() => setSelected(null)}
              isPanel
            />
          )}
        </div>
      </div>
    </div>
  );
}
