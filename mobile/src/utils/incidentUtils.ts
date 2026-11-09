/**
 * incidentUtils — shared utilities for incident display and status
 */

import { Timestamp } from 'firebase/firestore';
import { IncidentStatus } from '../types';

export const STATUS_COLORS: Record<IncidentStatus, string> = {
  unverified: '#F59E0B',
  verified: '#10B981',
  resolved: '#9CA3AF',
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  unverified: 'Unverified',
  verified: 'Verified',
  resolved: 'Resolved',
};

export function formatRelativeTime(ts: Timestamp | undefined): string {
  if (!ts) return '';
  const date = ts.toDate();
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (secs < 10) return 'Just now';
  if (secs < 60) return `${secs}s ago`;
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

/**
 * formatResponseTime — elapsed time between two timestamps.
 * Used to measure how quickly officials responded to an alert.
 */
export function formatResponseTime(
  from: Timestamp | undefined,
  to: Timestamp | undefined
): string {
  if (!from || !to) return '';
  const diff = to.toDate().getTime() - from.toDate().getTime();
  if (diff < 0) return '';
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  const remainSecs = secs % 60;
  const remainMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remainMins}m`;
  if (mins > 0) return `${mins}m ${remainSecs}s`;
  return `${secs}s`;
}

export function formatFullDate(ts: Timestamp | undefined): string {
  if (!ts) return '';
  return ts.toDate().toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
