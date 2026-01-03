import React from 'react';

export default function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || subtitle || actions) && (
        <div className="cardHeader">
          <div>
            {title && <p className="cardTitle">{title}</p>}
            {subtitle && <p className="pageSubtitle" style={{ margin: '6px 0 0' }}>{subtitle}</p>}
          </div>
          {actions ? <div className="row">{actions}</div> : null}
        </div>
      )}
      <div className="cardInner">{children}</div>
    </section>
  );
}
