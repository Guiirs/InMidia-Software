export default function Toolbar({ children, justify = 'space-between' }) {
  return (
    <div className="v4-toolbar" style={{ justifyContent: justify }}>
      {children}
    </div>
  );
}
