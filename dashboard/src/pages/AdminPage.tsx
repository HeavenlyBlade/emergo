/**
 * AdminPage — Module 9: Admin/Records
 *
 * Incident history with basic statistics and export.
 * Centralized record for future planning.
 */

import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../hooks/useAuth';
import { STATUS_BG, STATUS_LABELS, formatFullDate } from '../utils/incidentUtils';
import Sidebar from '../components/Sidebar';

export default function AdminPage() {
  const { incidents, loading } = useIncidents();
  const { userDoc } = useAuth();

  const stats = {
    total: incidents.length,
    unverified: incidents.filter((i) => i.status === 'unverified').length,
    verified: incidents.filter((i) => i.status === 'verified').length,
    resolved: incidents.filter((i) => i.status === 'resolved').length,
  };

  const handleExport = () => {
    // RFC-4180 compliant CSV — quotes all fields to handle commas, quotes, and newlines
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

    const rows = [
      ['ID', 'Status', 'Reported At', 'Reported By', 'Description', 'Verified By', 'Verified At', 'Resolved At'],
      ...incidents.map((i) => [
        i.id,
        i.status,
        i.reportedAt ? i.reportedAt.toDate().toISOString() : '',
        i.reportedBy,
        i.description ?? '',
        i.verifiedBy ?? '',
        i.verifiedAt ? i.verifiedAt.toDate().toISOString() : '',
        i.resolvedAt ? i.resolvedAt.toDate().toISOString() : '',
      ]),
    ];

    const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emergo-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    // Delay revoke to ensure download starts before the URL is freed
    setTimeout(() => URL.revokeObjectURL(url), 200);
  };

  return (
    <div className="flex h-screen">
      <Sidebar active="admin" userDoc={userDoc} />

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Records &amp; Admin</h1>
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
        <div className="grid grid-cols-4 gap-4 p-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900' },
            { label: 'Unverified', value: stats.unverified, color: 'text-amber-600' },
            { label: 'Verified', value: stats.verified, color: 'text-green-600' },
            { label: 'Resolved', value: stats.resolved, color: 'text-gray-500' },
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Reported At</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Reporter</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400">Loading...</td>
                  </tr>
                ) : incidents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400">No records yet.</td>
                  </tr>
                ) : (
                  incidents.map((incident) => (
                    <tr key={incident.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BG[incident.status]}`}>
                          {STATUS_LABELS[incident.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatFullDate(incident.reportedAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {incident.reportedBy.slice(-8)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {incident.description || 'No description'}
                      </td>
                    </tr>
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
