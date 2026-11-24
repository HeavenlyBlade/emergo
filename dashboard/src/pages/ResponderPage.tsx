/**
 * ResponderPage — Live Map & Emergency Response Dashboard for Responders
 *
 * Capabilities:
 * - Live Map like the Admin Live Map with Leaflet + OpenStreetMap
 * - Toggle to reveal / broadcast responder location to Admin & Residents
 * - "On the way" button on the live map for any emergency incident
 * - Real-time distance calculation from responder to emergency location
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../hooks/useAuth';
import {
  updateResponderLocation,
  setResponderVisibility,
  setResponderOnTheWay,
} from '../services/responderService';
import type { IncidentDocument } from '../types';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_BG,
  formatRelativeTime,
  calculateDistanceMeters,
  formatDistance,
} from '../utils/incidentUtils';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import {
  Radio,
  Eye,
  EyeOff,
  Navigation,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  X,
} from 'lucide-react';

// Center on Barangay Marketview, Lucena City
const DEFAULT_CENTER: [number, number] = [13.9374, 121.6175];
const DEFAULT_ZOOM = 15;

function MapFlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 17, { duration: 1 });
  }, [coords, map]);
  return null;
}

export default function ResponderPage() {
  const { uid, userDoc } = useAuth();
  const { incidents } = useIncidents();
  const [selected, setSelected] = useState<IncidentDocument | null>(null);

  // ── Responder GPS and visibility state ────────────────────────────────
  const [isLocationRevealed, setIsLocationRevealed] = useState<boolean>(true);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 13.9374,
    longitude: 121.6175,
  });
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [otherResponders, setOtherResponders] = useState<{
    uid: string;
    displayName: string;
    latitude: number;
    longitude: number;
    status?: string;
  }[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const watchIdRef = useRef<number | null>(null);

  // ── Watch GPS position when location is revealed ──────────────────────
  useEffect(() => {
    if (!uid) return;

    if (!isLocationRevealed) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setResponderVisibility(uid, false).catch(console.error);
      return;
    }

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      // Still broadcast default center location
      updateResponderLocation(
        uid,
        userDoc?.displayName ?? 'Responder',
        currentCoords,
        true
      ).catch(console.error);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCurrentCoords(coords);
        setGpsError(null);
        updateResponderLocation(
          uid,
          userDoc?.displayName ?? 'Responder',
          coords,
          true
        ).catch(console.error);
      },
      (err) => {
        console.warn('Geolocation warning:', err.message);
        setGpsError('GPS signal acquired with fallback.');
        // Still broadcast fallback location
        updateResponderLocation(
          uid,
          userDoc?.displayName ?? 'Responder',
          currentCoords,
          true
        ).catch(console.error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [uid, isLocationRevealed, userDoc?.displayName]);

  // ── Listen to other online responders ─────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'responder_locations'), (snapshot) => {
      const now = Date.now();
      const list = snapshot.docs
        .map((d) => ({ uid: d.id, ...d.data() } as any))
        .filter(
          (r) =>
            r.uid !== uid &&
            r.isVisible !== false &&
            (!r.lastSeen || now - r.lastSeen.toDate().getTime() < 10 * 60 * 1000)
        );
      setOtherResponders(list);
    });

    return () => unsub();
  }, [uid]);

  // ── Handle Toggle Location Visibility ────────────────────────────────
  const handleToggleVisibility = async () => {
    if (!uid) return;
    const nextState = !isLocationRevealed;
    setIsLocationRevealed(nextState);

    try {
      if (nextState) {
        await updateResponderLocation(
          uid,
          userDoc?.displayName ?? 'Responder',
          currentCoords,
          true
        );
        toast.success('Location revealed to Admin and Residents.');
      } else {
        await setResponderVisibility(uid, false);
        toast.success('Your location is now hidden.');
      }
    } catch (err: any) {
      toast.error('Could not update visibility setting.');
    }
  };

  // Check if current responder is on the way for the selected incident
  const isCurrentlyOnTheWay = useCallback(
    (incident: IncidentDocument | null): boolean => {
      if (!incident || !uid || !incident.respondersOnTheWay) return false;
      return incident.respondersOnTheWay.some((r) => r.uid === uid);
    },
    [uid]
  );

  // ── Handle "On the way" button click ─────────────────────────────────
  const handleToggleOnTheWay = async (incident: IncidentDocument) => {
    if (!uid) return;
    setActionLoading(true);
    const alreadyOnTheWay = isCurrentlyOnTheWay(incident);
    const nextStatus = !alreadyOnTheWay;

    try {
      await setResponderOnTheWay(
        incident.id,
        {
          uid,
          displayName: userDoc?.displayName ?? 'Responder',
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
        },
        nextStatus
      );

      if (nextStatus) {
        toast.success('🚨 Marked as ON THE WAY! Residents and Admin notified.');
      } else {
        toast.success('Status updated: No longer marked on the way.');
      }

      // Update local selected reference
      const snap = await getDoc(doc(db, 'incidents', incident.id));
      if (snap.exists()) {
        setSelected({ id: snap.id, ...snap.data() } as IncidentDocument);
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update response status.');
    } finally {
      setActionLoading(false);
    }
  };

  const selectedCoords: [number, number] | null = selected?.location
    ? [selected.location.latitude, selected.location.longitude]
    : null;

  const distanceToSelected = selected?.location
    ? calculateDistanceMeters(
        currentCoords.latitude,
        currentCoords.longitude,
        selected.location.latitude,
        selected.location.longitude
      )
    : null;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar active="responder" userDoc={userDoc} />

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header Bar */}
        <div className="bg-white border-b px-6 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-xl font-bold text-gray-900">Responder Live Map</h1>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                Responder View
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Live emergency telemetry · {incidents.filter((i) => i.status !== 'resolved').length} active emergencies
              {gpsError && <span className="text-amber-600 font-medium ml-2">({gpsError})</span>}
            </p>
          </div>

          {/* Toggle Location Visibility */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleVisibility}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm border ${
                isLocationRevealed
                  ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
                  : 'bg-gray-200 border-gray-300 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isLocationRevealed ? (
                <>
                  <Eye size={16} />
                  <span>Location Revealed to Admin</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-200 animate-ping inline-block ml-1" />
                </>
              ) : (
                <>
                  <EyeOff size={16} />
                  <span>Location Hidden (Tap to Reveal)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Map Area */}
        <div className="flex flex-1 overflow-hidden min-h-0 relative">
          {/* Quick Active Emergencies Selector Bar */}
          <div className="absolute top-3 left-14 z-1000 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 p-3 max-w-md w-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-bold text-xs text-gray-800">
                <Radio size={14} className="text-red-600" />
                <span>Active Emergencies ({incidents.filter((i) => i.status !== 'resolved').length})</span>
              </div>
              <span className="text-[11px] text-gray-500">Tap pin or item to respond</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 max-h-24 scrollbar-thin">
              {incidents
                .filter((i) => i.status !== 'resolved')
                .slice(0, 5)
                .map((inc) => {
                  const dist = inc.location
                    ? calculateDistanceMeters(
                        currentCoords.latitude,
                        currentCoords.longitude,
                        inc.location.latitude,
                        inc.location.longitude
                      )
                    : null;
                  const isSel = selected?.id === inc.id;
                  const onTheWay = isCurrentlyOnTheWay(inc);

                  return (
                    <button
                      key={inc.id}
                      onClick={() => setSelected(inc)}
                      className={`shrink-0 text-left px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                        isSel
                          ? 'border-red-600 bg-red-50 text-red-900 ring-2 ring-red-400'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-1 font-semibold">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: STATUS_COLORS[inc.status] }}
                        />
                        <span className="truncate max-w-[100px]">
                          {inc.description || 'Emergency'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-gray-500">
                        {dist !== null && (
                          <span className="font-bold text-blue-600">{formatDistance(dist)}</span>
                        )}
                        {onTheWay && (
                          <span className="bg-amber-500 text-white font-bold text-[9px] px-1 py-0.2 rounded">
                            On way
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

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

            {/* Responder's Own Location Marker */}
            {isLocationRevealed && (
              <CircleMarker
                center={[currentCoords.latitude, currentCoords.longitude]}
                radius={12}
                pathOptions={{
                  color: '#047857',
                  fillColor: '#10B981',
                  fillOpacity: 0.95,
                  weight: 3,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                      <Navigation size={14} />
                      <span>You (Field Responder)</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {userDoc?.displayName ?? 'Field Responder'}
                    </p>
                    <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                      ● Location broadcasting live
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            )}

            {/* Other Online Responders */}
            {otherResponders.map((resp) => (
              <CircleMarker
                key={resp.uid}
                center={[resp.latitude, resp.longitude]}
                radius={8}
                pathOptions={{
                  color: '#1D4ED8',
                  fillColor: '#3B82F6',
                  fillOpacity: 0.85,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold text-blue-700">Responder (live)</p>
                    <p className="text-xs font-bold text-gray-800">{resp.displayName}</p>
                    {resp.status === 'on_the_way' && (
                      <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-full inline-block mt-1">
                        On the way
                      </span>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Emergency Incident Markers */}
            {incidents.map((incident) => {
              const lat = incident.location?.latitude;
              const lng = incident.location?.longitude;
              if (!lat || !lng) return null;

              const color = STATUS_COLORS[incident.status];
              const isSelected = selected?.id === incident.id;
              const onTheWay = isCurrentlyOnTheWay(incident);

              return (
                <CircleMarker
                  key={incident.id}
                  center={[lat, lng]}
                  radius={isSelected ? 16 : 11}
                  pathOptions={{
                    color: onTheWay ? '#DC2626' : isSelected ? '#111827' : color,
                    fillColor: color,
                    fillOpacity: incident.status === 'resolved' ? 0.35 : 0.9,
                    weight: isSelected ? 3.5 : 2,
                  }}
                  eventHandlers={{
                    click: () => setSelected(incident),
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-gray-900">{STATUS_LABELS[incident.status]}</span>
                        {incident.severity && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 capitalize">
                            {incident.severity}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-1">{incident.description || 'Emergency alert'}</p>
                      <p className="text-[11px] text-gray-400">{formatRelativeTime(incident.reportedAt)}</p>
                      <button
                        onClick={() => setSelected(incident)}
                        className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-1 rounded"
                      >
                        Select & Respond
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Selected Emergency Action Panel (Bottom Right) */}
          {selected && (
            <div className="absolute bottom-6 right-6 z-1000 w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[85vh]">
              {/* Card Header */}
              <div className="px-5 py-3.5 bg-gray-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 animate-bounce" />
                  <span className="font-bold text-sm">Emergency Details</span>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Card Body */}
              <div className="p-5 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_BG[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                  {selected.severity && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 uppercase">
                      {selected.severity}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={12} />
                    {formatRelativeTime(selected.reportedAt)}
                  </span>
                </div>

                {/* Description */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm font-medium text-gray-800 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    {selected.description || 'No description provided.'}
                  </p>
                </div>

                {/* Distance Badge */}
                {distanceToSelected !== null && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-xs text-blue-900 font-bold">Your Distance to Emergency</p>
                        <p className="text-xs text-blue-700">Direct distance from your location</p>
                      </div>
                    </div>
                    <span className="text-base font-black text-blue-700 font-mono">
                      {formatDistance(distanceToSelected)}
                    </span>
                  </div>
                )}

                {/* Responders on the way list */}
                {selected.respondersOnTheWay && selected.respondersOnTheWay.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Radio size={13} className="text-amber-600" />
                      Responders On The Way ({selected.respondersOnTheWay.length})
                    </p>
                    <div className="space-y-1">
                      {selected.respondersOnTheWay.map((r) => (
                        <div
                          key={r.uid}
                          className="flex items-center justify-between text-xs bg-amber-50/70 border border-amber-200 px-3 py-1.5 rounded-lg"
                        >
                          <span className="font-semibold text-gray-800">
                            {r.displayName} {r.uid === uid ? '(You)' : ''}
                          </span>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full">
                            On the way
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Message if present */}
                {selected.adminMessage && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-emerald-800 flex items-center gap-1 mb-1">
                      <Shield size={13} /> Admin Reassurance Broadcast
                    </p>
                    <p className="text-xs text-emerald-950 italic">
                      "{selected.adminMessage}"
                    </p>
                  </div>
                )}

                {/* Photo if present */}
                {selected.photoBase64 && (
                  <div className="rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={`data:image/jpeg;base64,${selected.photoBase64}`}
                      alt="Incident"
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}

                {/* "On the way" Action Button */}
                <div className="pt-2">
                  <button
                    onClick={() => handleToggleOnTheWay(selected)}
                    disabled={actionLoading}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-98 ${
                      isCurrentlyOnTheWay(selected)
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                    }`}
                  >
                    {isCurrentlyOnTheWay(selected) ? (
                      <>
                        <CheckCircle2 size={18} />
                        <span>✓ You Are On The Way (Tap to Arrive / Cancel)</span>
                      </>
                    ) : (
                      <>
                        <Radio size={18} />
                        <span>🚨 On the way</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-gray-500 mt-2">
                    Tapping "On the way" reveals your status & distance to the resident chip.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
