function formatDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));

  if (total === 0) {
    return '0m';
  }

  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);

  return parts.join(' ');
}

module.exports = { formatDuration };
