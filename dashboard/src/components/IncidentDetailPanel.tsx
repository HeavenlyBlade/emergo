/**
 * IncidentDetailPanel  EModule 7 & 8
 *
 * Shows incident details and verify/resolve actions.
 *
 * Role gate:
 *   - Only role == 'official' can verify or resolve
 *   - Tanods can view but not act
 *   - Enforced here AND in Firestore rules
 */

import { useState } from 'react';
import { X, MapPin, Clock, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { IncidentDocument, UserRole } from '../types';
import { verifyIncident, resolveIncident } from '../services/incidentService';
import { STATUS_BG, STATUS_LABELS, formatFullDate } from '../utils/incidentUtils';

interface Props {
  incident: IncidentDocument;
  uid: string;
  userRole: UserRole;
  onClose: () => void;
  isPanel?: boolean; // true = right side panel, false = map overlay
}

export default function IncidentDetailPanel({
  incident,
  uid,
  userRole,
  onClose,
  isPanel = false,
}: Props) {
  const [loading, setLoading] = useState<'verify' | 'resolve' | null>(null);

  const canAct = userRole === 'official';

  const handleVerify = async () => {
    if (!canAct) { toast.error('Only officials can verify incidents.'); return; }
    setLoading('verify');
    try {
      await verifyIncident(incident.id, uid);
      toast.success('Incident verified.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not verify.');
    } finally {
      setLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!canAct) { toast.error('Only officials can resolve incidents.'); return; }
    setLoading('resolve');
    try {
      await resolveIncident(incident.id, uid);
      toast.success('Incident resolved.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not resolve.');
    } finally {
      setLoading(null);
    }
  };

  const panelClass = isPanel
    ? 'w-80 border-l border-gray-200 bg-white flex flex-col h-full'
    : 'absolute bottom-4 right-4 w-80 bg-white rounded-2xl shadow-xl z-10 flex flex-col max-h-[80%]';

  return (
    <div className={panelClass}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BG[incident.status]}`}>
          {STATUS_LABELS[incident.status]}
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Description */}
        <div>
          <p className="text-sm font-semibold text-gray-700">Description</p>
          <p className="text-sm text-gray-600 mt-1">
            {incident.description || 'No description provided.'}
          </p>
        </div>

        {/* Location */}
        <div>
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1">
            <MapPin size={14} /> Location
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {incident.location
              ? `${incident.location.latitude.toFixed(6)}, ${incident.location.longitude.toFixed(6)}`
              : 'Unknown'}
          </p>
          {incident.location && (
            <a
              href={`https://maps.google.com/?q=${incident.location.latitude},${incident.location.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:underline mt-1 block"
            >
              Open in Google Maps ↁE            </a>
          )}
        </div>

        {/* Timeline */}
        <div>
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1">
            <Clock size={14} /> Timeline
          </p>
          <div className="mt-1 space-y-1 text-xs text-gray-500">
            <p>Reported: {formatFullDate(incident.reportedAt)}</p>
            {incident.verifiedAt && (
              <p>Verified: {formatFullDate(incident.verifiedAt)}</p>
            )}
            {incident.resolvedAt && (
              <p>Resolved: {formatFullDate(incident.resolvedAt)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions  EModule 8: Incident Verification & Resolution */}
      {canAct && incident.status !== 'resolved' && (
        <div className="border-t border-gray-100 p-4 space-y-2">
          {incident.status === 'unverified' && (
            <button
              onClick={handleVerify}
              disabled={loading === 'verify'}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold h-10 rounded-lg disabled:opacity-60 text-sm"
            >
              <CheckCircle size={16} />
              {loading === 'verify' ? 'Verifying...' : 'Verify Incident'}
            </button>
          )}
          {incident.status === 'verified' && (
            <button
              onClick={handleResolve}
              disabled={loading === 'resolve'}
              className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-semibold h-10 rounded-lg disabled:opacity-60 text-sm"
            >
              <XCircle size={16} />
              {loading === 'resolve' ? 'Resolving...' : 'Mark as Resolved'}
            </button>
          )}
        </div>
      )}

      {!canAct && incident.status !== 'resolved' && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400 text-center">
            Only officials can verify or resolve incidents.
          </p>
        </div>
      )}
    </div>
  );
}
