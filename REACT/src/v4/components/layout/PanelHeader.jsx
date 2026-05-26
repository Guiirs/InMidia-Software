export default function PanelHeader({ children, divider = true }) {
  return (
    <div className={`v4-panel-header${divider ? ' v4-panel-header--divider' : ''}`}>
      {children}
    </div>
  );
}
