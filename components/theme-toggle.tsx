"use client";

type ThemeToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  hint?: string;
  label?: string;
};

export function ThemeToggle({
  checked,
  onChange,
  className,
  hint = "Tema serale con contrasti luminosi",
  label = "Dark mode"
}: ThemeToggleProps) {
  return (
    <button
      aria-checked={checked}
      aria-label={checked ? "Disattiva modalita scura" : "Attiva modalita scura"}
      className={`theme-toggle${checked ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span className="theme-toggle-copy">
        <span className="theme-toggle-label">{label}</span>
        <span className="theme-toggle-hint">{hint}</span>
      </span>
      <span aria-hidden className="theme-switch">
        <span className="theme-switch-thumb">
          <span className="theme-switch-core" />
        </span>
      </span>
    </button>
  );
}
