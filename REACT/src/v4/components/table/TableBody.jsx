export default function TableBody({ children, className = '' }) {
  return (
    <tbody className={`v4-table-body${className ? ` ${className}` : ''}`}>
      {children}
    </tbody>
  );
}
