/**
 * IncidentsPage  EModule 7: Dashboard List & Detail Panel
 *
 * Filterable incident list with real-time updates.
 * Clicking an incident opens the detail panel with verify/resolve actions.
 */

import { useState } from 'react';
import { useIncidents } from '../hooks/useIncidents';
import { useUsers } from '../hooks/useUsers';
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

const TIME_FILTERS: { label: string; value: string }[] = [
  { label: 'All time',     value: 'all' },
  { label: 'Last 15 min', value: '15m' },
  { label: 'Last hour',   value: '1h'  },
  { label: 'Today',       value: 'today' },
  { label: 'This week',   value: 'week' },
  { label: 'This month',  value: 'month' },
];

export default function IncidentsPage() {
  const { incidents, loading } = useIncidents();
  const { usersMap } = useUsers();
  const { uid, userDoc } = useAuth();
  const [filter, setFilter] = useState<IncidentStatus | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [selected, setSelected] = useState<IncidentDocument | null>(null);

  const statusFiltered = filter === 'all'
    ? incidents
    : incidents.filter((i) => i.status === filter);

  const timeFiltered = timeFilter === 'all' ? statusFiltered : statusFiltered.filter((i) => {
    if (!i.reportedAt) return false;
    const t = i.reportedAt.toDate();
    const now = new Date();
    if (timeFilter === '15m')  return now.getTime() - t.getTime() <= 15 * 60 * 1000;
    if (timeFilter === '1h')   return now.getTime() - t.getTime() <= 60 * 60 * 1000;
    if (timeFilter === 'today') {
      return t.getFullYear() === now.getFullYear() &&
             t.getMonth()    === now.getMonth()    &&
             t.getDate()     === now.getDate();
    }
    if (timeFilter === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return t >= weekAgo;
    }
    if (timeFilter === 'month') {
      return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth();
    }
    return true;
  });

  return (
    <div className="flex h-screen">
      <Sidebar active="incidents" userDoc={userDoc} />

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">Incidents</h1>
          <p className="text-sm text-gray-500">{incidents.length} total reports</p>
        </div>

        {/* Status Filters */}
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

        {/* Time Filters */}
        <div className="bg-white border-b px-6 py-2 flex gap-2 flex-wrap">
          {TIME_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTimeFilter(f.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                timeFilter === f.value
                  ? 'bg-red-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading incidents...</div>
          ) : timeFiltered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No incidents found.</div>
          ) : (
            <div className="space-y-2">
              {timeFiltered.map((incident) => (
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
          userRole={userDoc?.role ?? 'resident'}
          onClose={() => setSelected(null)}
          isPanel
          usersMap={usersMap}
        />
      )}
    </div>
  );
}
