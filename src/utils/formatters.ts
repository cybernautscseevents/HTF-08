// Formatters — display utilities for amounts, dates, risk, etc.

export function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatCurrencyFull(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatDate(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function formatDateTime(timestamp: string): string {
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
}

export function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(timestamp);
}

export function formatDelay(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatScore(score: number): string {
  return `${score}/100`;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    normal: 'Normal',
    watch: 'Watch',
    high: 'High Risk',
    critical: 'Critical',
    frozen: 'Frozen',
    open: 'Open',
    investigating: 'Investigating',
    escalated: 'Escalated',
    resolved: 'Resolved',
    closed: 'Closed',
    completed: 'Completed',
    pending: 'Pending',
    flagged: 'Flagged',
  };
  return labels[status] || status;
}

export function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    victim: 'Victim',
    mule: 'Mule',
    normal: 'Normal',
    merchant: 'Merchant',
    salary: 'Salary',
    cashout: 'Cashout',
  };
  return labels[type] || type;
}
