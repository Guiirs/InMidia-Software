export default function SurfaceCard({ children, variant = 'default' }) {
  return (
    <div className={`v4-surface-card v4-surface-card--${variant}`}>
      {children}
    </div>
  );
}
