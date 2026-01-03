import React from 'react';

export default function Button({
  variant = 'secondary',
  as: As,
  className = '',
  children,
  ...props
}) {
  const base = 'btn';
  const variantClass =
    variant === 'primary'
      ? 'btnPrimary'
      : variant === 'danger'
      ? 'btnDanger'
      : variant === 'ghost'
      ? 'btnGhost'
      : 'btnSecondary';

  const Comp = As || 'button';

  return (
    <Comp className={`${base} ${variantClass} ${className}`} {...props}>
      {children}
    </Comp>
  );
}
