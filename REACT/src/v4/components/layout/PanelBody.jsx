export default function PanelBody({ children, padding = true }) {
  return (
    <div className={`v4-panel-body${padding ? ' v4-panel-body--padded' : ''}`}>
      {children}
    </div>
  );
}
