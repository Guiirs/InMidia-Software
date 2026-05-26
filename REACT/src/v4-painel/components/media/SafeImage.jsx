import { memo, useEffect, useState } from 'react';

function SafeImage({
  src,
  alt = '',
  className = '',
  fallbackClassName = '',
  fallbackStyle,
  fallbackLabel = 'Sem imagem cadastrada',
  onBroken,
  children,
  ...props
}) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  if (!src || broken) {
    return (
      <div className={fallbackClassName || className} role="img" aria-label={fallbackLabel} style={fallbackStyle ?? props.style}>
        {children ?? <span>{fallbackLabel}</span>}
      </div>
    );
  }

  return (
    <img
      {...props}
      className={className}
      src={src}
      alt={alt}
      onError={() => {
        setBroken(true);
        onBroken?.(src);
      }}
    />
  );
}

export default memo(SafeImage);
