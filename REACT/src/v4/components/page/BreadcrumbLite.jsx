export default function BreadcrumbLite({ items = [] }) {
  if (items.length === 0) return null;

  return (
    <nav className="v4-breadcrumb-lite" aria-label="Navegação de contexto">
      <ol className="v4-breadcrumb-lite__list">
        {items.map((item, index) => (
          <li key={index} className="v4-breadcrumb-lite__item">
            {item.href ? (
              <a href={item.href} className="v4-breadcrumb-lite__link">
                {item.label}
              </a>
            ) : (
              <span className="v4-breadcrumb-lite__current">{item.label}</span>
            )}
            {index < items.length - 1 && (
              <span className="v4-breadcrumb-lite__separator">/</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
