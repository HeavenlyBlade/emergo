/**
 * MapPage — Module 6: Dashboard Live Map
 *
 * Real-time Firestore listener on incidents collection.
 * Status-differentiated pins:
 *   - unverified: amber/pulsing
 *   - verified: green/solid
 *   - resolved: gray
 *
 * Clicking a pin opens the incident detail panel.
 *
 * Uses Google Maps JavaScript API via @vis.gl/react-google-maps.
 * NOT the mobile SDK — see steering file.
 */

import { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../hooks/useAuth';
import { IncidentDocument } from '../types';
import { STATUS_COLORS, STATUS_LABELS, formatRelativeTime } from '../utils/incidentUtils';
import IncidentDetailPanel from '../components/IncidentDetailPanel';
import Sidebar from '../components/Sidebar';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Center on Barangay Marketview, Lucena City
const DEFAULT_CENTER = { lat: 13.9374, lng: 121.6175 };

export default function MapPage() {
  const { incidents, loading } = useIncidents();
  const { uid, userDoc } = useAuth();
  const [selected, setSelected] = useState<IncidentDocument | null>(null);

  if (!MAPS_API_KEY || MAPS_API_KEY === 'your_google_maps_web_api_key_here') {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <p className="text-lg font-semibold text-gray-700">Google Maps API key not configured</p>
          <p className="text-sm text-gray-500 mt-2">
            Add <code className="bg-gray-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> to your <code>.env</code> file
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar active="map" userDoc={userDoc} />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Live Map</h1>
            <p className="text-sm text-gray-500">
              {incidents.filter(i => i.status === 'unverified').length} unverified ·{' '}
              {incidents.filter(i => i.status === 'verified').length} verified ·{' '}
              {incidents.filter(i => i.status === 'resolved').length} resolved
            </p>
          </div>
          <div className="flex gap-4 text-xs text-gray-600">
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <span key={status} className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: STATUS_COLORS[status as keyof typeof STATUS_COLORS] }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <APIProvider apiKey={MAPS_API_KEY}>
            <Map
              defaultCenter={DEFAULT_CENTER}
              defaultZoom={15}
              mapId="emergo-map"
              style={{ width: '100%', height: '100%' }}
            >
              {incidents.map((incident) => {
                const lat = incident.location?.latitude;
                const lng = incident.location?.longitude;
                if (!lat || !lng) return null;

                const color = STATUS_COLORS[incident.status];
                const isSelected = selected?.id === incident.id;

                return (
                  <AdvancedMarker
                    key={incident.id}
                    position={{ lat, lng }}
                    onClick={() => setSelected(incident)}
                  >
                    <Pin
                      background={color}
                      borderColor={isSelected ? '#111' : color}
                      glyphColor="#fff"
                      scale={isSelected ? 1.4 : 1.0}
                    />
                  </AdvancedMarker>
                );
              })}
            </Map>
          </APIProvider>

          {/* Detail panel */}
          {selected && (
            <IncidentDetailPanel
              incident={selected}
              uid={uid!}
              userRole={userDoc?.role ?? 'tanod'}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
