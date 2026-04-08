"use client";

type ThemeToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function ThemeToggle({ checked, onChange }: ThemeToggleProps) {
  return (
    <button
      aria-checked={checked}
      aria-label={checked ? "Disattiva modalita scura" : "Attiva modalita scura"}
      className={`theme-toggle${checked ? " is-active" : ""}`}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span className="theme-toggle-copy">
        <span className="theme-toggle-label">Modalita scura</span>
        <span className="theme-toggle-hint">Tema serale con contrasti luminosi</span>
      </span>
      <span aria-hidden className="theme-switch">
        <span className="theme-switch-thumb">
          <span className="theme-switch-core" />
        </span>
      </span>
    </button>
  );
}
