/* Estado de carregamento para cards, tabelas e painéis */
import { memo } from 'react';

function SkeletonLine({ width = '100%', height = 14, radius = 4, style }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, var(--v4p-bg-card) 25%, var(--v4p-bg-card-hover) 50%, var(--v4p-bg-card) 75%)',
        backgroundSize: '200% 100%',
        animation: 'v4p-skeleton 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

function LoadingState({ rows = 3, compact = false, label = 'Carregando informações…' }) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 8 : 12,
        padding: compact ? '12px 0' : '20px 0',
      }}
    >
      <style>{`
        @keyframes v4p-skeleton {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === rows - 1 ? '60%' : `${85 + Math.random() * 15}%`}
          height={compact ? 12 : 14}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function LoadingSpinner({ size = 20, color = 'var(--v4p-accent)' }) {
  return (
    <span
      role="status"
      aria-label="Carregando…"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
        animation: 'v4p-spin 0.7s linear infinite',
      }}
    />
  );
}

export default memo(LoadingState);
