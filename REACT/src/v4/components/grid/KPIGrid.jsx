export default function KPIGrid({ children, columns = 4 }) {
  return (
    <div className="v4-kpi-grid" style={{ '--v4-grid-columns': columns }}>
      {children}
    </div>
  );
}
