/**
 * AdminPage — Module 9: Admin/Records
 *
 * Incident history with statistics, export, and expandable detail rows.
 * Clicking a row expands it to show the full incident details including photo.
 */

import { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../hooks/useAuth';
import { STATUS_BG, STATUS_LABELS, formatFullDate, formatResponseTime } from '../utils/incidentUtils';
import Sidebar from '../components/Sidebar';
import type { IncidentDocument } from '../types';

const SEVERITY_BG: Record<string, string> = {
  light:    'bg-amber-100 text-amber-800',
  moderate: 'bg-orange-100 text-orange-800',
  extreme:  'bg-red-100 text-red-800',
};

export default function AdminPage() {
  const { incidents, loading } = useIncidents();
  const { userDoc } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);

  const stats = {
    total:      incidents.length,
    unverified: incidents.filter((i) => i.status === 'unverified').length,
    verified:   incidents.filter((i) => i.status === 'verified').length,
    resolved:   incidents.filter((i) => i.status === 'resolved').length,
  };

  const handleExport = () => {
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      ['ID', 'Status', 'Severity', 'Reported At', 'Reported By', 'Description', 'Has Photo', 'Verified By', 'Verified At', 'Resolved At'],
      ...incidents.map((i) => [
        i.id,
        i.status,
        i.severity ?? '',
        i.reportedAt ? i.reportedAt.toDate().toISOString() : '',
        i.reportedBy,
        i.description ?? '',
        i.photoBase64 ? 'Yes' : 'No',
        i.verifiedBy ?? '',
        i.verifiedAt  ? i.verifiedAt.toDate().toISOString()  : '',
        i.resolvedAt  ? i.resolvedAt.toDate().toISOString()  : '',
      ]),
    ];
    const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `emergo-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 200);
  };

  const toggleRow = (id: string) => setExpanded(expanded === id ? null : id);

  return (
    <div className="flex h-screen">
      <Sidebar active="admin" userDoc={userDoc} />

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Records</h1>
            <p className="text-sm text-gray-500">Incident history for Barangay Marketview</p>
          </div>
          <button
            onClick={handleExport}
            className="bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            Export CSV
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 p-6 shrink-0">
          {[
            { label: 'Total',      value: stats.total,      color: 'text-gray-900'  },
            { label: 'Unverified', value: stats.unverified, color: 'text-amber-600' },
            { label: 'Verified',   value: stats.verified,   color: 'text-green-600' },
            { label: 'Resolved',   value: stats.resolved,   color: 'text-gray-500'  },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 w-8" />
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Severity</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Reported At</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Photo</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td>
                  </tr>
                ) : incidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">No records yet.</td>
                  </tr>
                ) : (
                  incidents.map((incident) => (
                    <IncidentRow
                      key={incident.id}
                      incident={incident}
                      isExpanded={expanded === incident.id}
                      onToggle={() => toggleRow(incident.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Expandable row ───────────────────────────────────────────────────────────

function IncidentRow({
  incident,
  isExpanded,
  onToggle,
}: {
  incident: IncidentDocument;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* Summary row */}
      <tr
        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
          isExpanded ? 'bg-gray-50' : ''
        }`}
        onClick={onToggle}
      >
        {/* Chevron */}
        <td className="px-4 py-3 text-gray-400">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
        {/* Status */}
        <td className="px-4 py-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BG[incident.status]}`}>
            {STATUS_LABELS[incident.status]}
          </span>
        </td>
        {/* Severity */}
        <td className="px-4 py-3">
          {incident.severity ? (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_BG[incident.severity] ?? ''}`}>
              {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
        {/* Reported At */}
        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
          {formatFullDate(incident.reportedAt)}
        </td>
        {/* Description */}
        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
          {incident.description || <span className="text-gray-400 italic">No description</span>}
        </td>
        {/* Photo indicator */}
        <td className="px-4 py-3">
          {incident.photoBase64 ? (
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Photo
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr className="bg-gray-50 border-b border-gray-200">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid grid-cols-2 gap-6">

              {/* Left column: photo */}
              <div>
                {incident.photoBase64 ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Incident Photo
                    </p>
                    <img
                      src={`data:image/jpeg;base64,${incident.photoBase64}`}
                      alt="Incident photo"
                      className="w-full rounded-lg object-cover max-h-64 border border-gray-200"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 bg-gray-100 rounded-lg border border-dashed border-gray-300">
                    <p className="text-sm text-gray-400">No photo attached</p>
                  </div>
                )}
              </div>

              {/* Right column: details */}
              <div className="space-y-3">
                {/* Description */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</p>
                  <p className="text-sm text-gray-700 mt-1">
                    {incident.description || 'No description provided.'}
                  </p>
                </div>

                {/* Location */}
                {incident.location && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</p>
                    <p className="text-sm text-gray-700 mt-1 font-mono">
                      {incident.location.latitude.toFixed(6)}, {incident.location.longitude.toFixed(6)}
                    </p>
                    <a
                      href={`https://maps.google.com/?q=${incident.location.latitude},${incident.location.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin size={11} /> Open in Google Maps
                    </a>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Timeline</p>
                  <div className="mt-1 space-y-1 text-xs text-gray-600">
                    <p>Reported: {formatFullDate(incident.reportedAt)}</p>
                    {incident.verifiedAt && (
                      <>
                        <p>Verified: {formatFullDate(incident.verifiedAt)}</p>
                        <p className="text-green-600 font-medium">
                          Response time: {formatResponseTime(incident.reportedAt, incident.verifiedAt)}
                        </p>
                      </>
                    )}
                    {incident.resolvedAt && (
                      <p>Resolved: {formatFullDate(incident.resolvedAt)}</p>
                    )}
                  </div>
                </div>

                {/* Reporter UID (truncated) */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reporter ID</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">{incident.reportedBy}</p>
                </div>
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}
