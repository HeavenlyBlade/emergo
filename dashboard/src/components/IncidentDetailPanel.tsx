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
import { X, MapPin, Clock, CheckCircle, XCircle, Send, MessageSquare, Radio } from 'lucide-react';
import toast from 'react-hot-toast';
import type { IncidentDocument, UserRole } from '../types';
import { verifyIncident, resolveIncident, sendAdminMessage, DEFAULT_ADMIN_MESSAGE } from '../services/incidentService';
import { STATUS_BG, STATUS_LABELS, formatFullDate, formatResponseTime, formatRelativeTime } from '../utils/incidentUtils';

interface Props {
  incident: IncidentDocument;
  uid: string;
  userRole: UserRole;
  onClose: () => void;
  isPanel?: boolean; // true = right side panel, false = map overlay
  usersMap?: Record<string, string>;
}

export default function IncidentDetailPanel({
  incident,
  uid,
  userRole,
  onClose,
  isPanel = false,
  usersMap,
}: Props) {
  const [loading, setLoading] = useState<'verify' | 'resolve' | 'message' | null>(null);
  const reporterName = (usersMap && usersMap[incident.reportedBy]) ? usersMap[incident.reportedBy] : incident.reportedBy;

  const canAct = userRole === 'official' || userRole === 'admin';

  const handleVerify = async () => {
    if (!canAct) { toast.error('Only officials can verify incidents.'); return; }
    setLoading('verify');
    try {
      // Auto-send the verification reassurance message upon verification
      await verifyIncident(incident.id, uid, DEFAULT_ADMIN_MESSAGE);
      toast.success('Incident verified & reassurance message sent to resident.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not verify.');
    } finally {
      setLoading(null);
    }
  };

  const handleSendMessage = async () => {
    if (!canAct) { toast.error('Only officials can send alert messages.'); return; }
    setLoading('message');
    try {
      await sendAdminMessage(incident.id, uid, DEFAULT_ADMIN_MESSAGE);
      toast.success('Reassurance message sent to resident.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not send message.');
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
        {incident.severity && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-1 ${
            incident.severity === 'light'
              ? 'bg-amber-100 text-amber-800'
              : incident.severity === 'moderate'
              ? 'bg-orange-100 text-orange-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
          </span>
        )}
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

        {/* Photo */}
        {incident.photoBase64 && (
          <div>
            <p className="text-sm font-semibold text-gray-700">Photo</p>
            <img
              src={`data:image/jpeg;base64,${incident.photoBase64}`}
              alt="Incident photo"
              className="mt-1 w-full rounded-lg object-cover max-h-48"
            />
          </div>
        )}

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
              Open in Google Maps &rarr;</a>
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
              <>
                <p>Verified: {formatFullDate(incident.verifiedAt)}</p>
                <p className="text-green-600 font-medium">
                  Response time: {formatResponseTime(incident.reportedAt, incident.verifiedAt)}
                </p>
              </>
            )}
            {incident.resolvedAt && (
              <>
                <p>Resolved: {formatFullDate(incident.resolvedAt)}</p>
                {incident.verifiedAt && (
                  <p className="text-gray-500 font-medium">
                    Resolution time: {formatResponseTime(incident.reportedAt, incident.resolvedAt)}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Reported By */}
        <div>
          <p className="text-sm font-semibold text-gray-700">Reported By</p>
          <p className="text-xs text-gray-500 mt-1 font-mono">{reporterName}</p>
        </div>

        {/* Responders On The Way */}
        {incident.respondersOnTheWay && incident.respondersOnTheWay.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-2">
              <Radio size={14} className="text-amber-600 animate-pulse" />
              Responders On The Way ({incident.respondersOnTheWay.length})
            </p>
            <div className="space-y-1.5">
              {incident.respondersOnTheWay.map((r) => (
                <div key={r.uid} className="flex items-center justify-between bg-white/80 rounded-lg px-2.5 py-1.5 text-xs border border-amber-100">
                  <span className="font-semibold text-gray-800">{r.displayName}</span>
                  <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                    On the way
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resident Communication / Admin Message */}
        {incident.adminMessage ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 mb-1">
              <MessageSquare size={14} className="text-blue-600" />
              Message Sent to Resident
            </div>
            <p className="text-xs text-blue-950 font-medium italic">
              "{incident.adminMessage}"
            </p>
            {incident.adminMessageSentAt && (
              <p className="text-[10px] text-blue-600 mt-1">
                Sent {formatRelativeTime(incident.adminMessageSentAt)}
              </p>
            )}
          </div>
        ) : incident.status === 'verified' && canAct && (
          <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-3">
            <p className="text-xs text-gray-600 mb-2">
              Notify the resident that help is on the way:
            </p>
            <button
              onClick={handleSendMessage}
              disabled={loading === 'message'}
              className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded-lg text-xs transition-colors shadow-xs"
            >
              <Send size={13} />
              {loading === 'message'
                ? 'Sending...'
                : 'Send: "The emergency has been received..."'}
            </button>
          </div>
        )}
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
            <>
              {!incident.adminMessage && (
                <button
                  onClick={handleSendMessage}
                  disabled={loading === 'message'}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10 rounded-lg disabled:opacity-60 text-sm"
                >
                  <Send size={16} />
                  {loading === 'message' ? 'Sending message...' : 'Send Reassurance Message'}
                </button>
              )}
              <button
                onClick={handleResolve}
                disabled={loading === 'resolve'}
                className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-semibold h-10 rounded-lg disabled:opacity-60 text-sm"
              >
                <XCircle size={16} />
                {loading === 'resolve' ? 'Resolving...' : 'Mark as Resolved'}
              </button>
            </>
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
