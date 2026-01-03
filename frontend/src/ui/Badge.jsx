import React from 'react';

export default function Badge({ tone = 'neutral', children, className = '' }) {
  const toneClass =
    tone === 'todo'
      ? 'badgeTodo'
      : tone === 'in_progress'
      ? 'badgeInProgress'
      : tone === 'done'
      ? 'badgeDone'
      : tone === 'cancelled'
      ? 'badgeCancelled'
      : '';

  return <span className={`badge ${toneClass} ${className}`}>{children}</span>;
}
