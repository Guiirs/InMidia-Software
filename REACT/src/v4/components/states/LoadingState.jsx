export default function LoadingState({ message = 'Carregando...' }) {
  return (
    <div className="v4-loading-state">
      <div className="v4-loading-state__spinner"></div>
      <span>{message}</span>
    </div>
  );
}
