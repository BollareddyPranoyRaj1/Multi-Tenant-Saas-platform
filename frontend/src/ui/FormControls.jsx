import React from 'react';

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label ? <div className="label">{label}</div> : null}
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function Input(props) {
  return <input className="input" {...props} />;
}

export function Textarea(props) {
  return <textarea className="textarea" {...props} />;
}

export function Select(props) {
  return <select className="select" {...props} />;
}
