import type { IncidentStatus, TimestampLike } from '../types';

export const STATUS_COLORS: Record<IncidentStatus, string> = {
  unverified: '#F59E0B',
  verified: '#10B981',
  resolved: '#9CA3AF',
};

export const STATUS_BG: Record<IncidentStatus, string> = {
  unverified: 'bg-amber-100 text-amber-800',
  verified: 'bg-green-100 text-green-800',
  resolved: 'bg-gray-100 text-gray-600',
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  unverified: 'Unverified',
  verified: 'Verified',
  resolved: 'Resolved',
};

export function formatRelativeTime(ts: TimestampLike | undefined): string {
  if (!ts) return '';
  const date = ts.toDate();
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export function formatFullDate(ts: TimestampLike | undefined): string {
  if (!ts) return '';
  return ts.toDate().toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
