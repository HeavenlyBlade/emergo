/**
 * IncidentsPage  EModule 7: Dashboard List & Detail Panel
 *
 * Filterable incident list with real-time updates.
 * Clicking an incident opens the detail panel with verify/resolve actions.
 */

import { useState } from 'react';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../hooks/useAuth';
import type { IncidentDocument, IncidentStatus } from '../types';
import { STATUS_BG, STATUS_LABELS, formatRelativeTime, formatFullDate } from '../utils/incidentUtils';
import IncidentDetailPanel from '../components/IncidentDetailPanel';
import Sidebar from '../components/Sidebar';

const FILTERS: { label: string; value: IncidentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unverified', value: 'unverified' },
  { label: 'Verified', value: 'verified' },
  { label: 'Resolved', value: 'resolved' },
];

export default function IncidentsPage() {
  const { incidents, loading } = useIncidents();
  const { uid, userDoc } = useAuth();
  const [filter, setFilter] = useState<IncidentStatus | 'all'>('all');
  const [selected, setSelected] = useState<IncidentDocument | null>(null);

  const filtered = filter === 'all'
    ? incidents
    : incidents.filter((i) => i.status === filter);

  return (
    <div className="flex h-screen">
      <Sidebar active="incidents" userDoc={userDoc} />

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">Incidents</h1>
          <p className="text-sm text-gray-500">{incidents.length} total reports</p>
        </div>

        {/* Filters */}
        <div className="bg-white border-b px-6 py-2 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'bg-red-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              {f.value !== 'all' && (
                <span className="ml-1 opacity-70">
                  ({incidents.filter((i) => i.status === f.value).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading incidents...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No incidents found.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((incident) => (
                <button
                  key={incident.id}
                  onClick={() => setSelected(incident)}
                  className={`w-full text-left bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${
                    selected?.id === incident.id ? 'border-red-400 shadow-md' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BG[incident.status]}`}>
                      {STATUS_LABELS[incident.status]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatRelativeTime(incident.reportedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    {incident.description || 'Emergency alert'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatFullDate(incident.reportedAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
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
  );
}
