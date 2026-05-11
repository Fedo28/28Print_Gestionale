export function UndoButtonContent({
  label,
  count
}: {
  label: string;
  count?: number;
}) {
  return (
    <>
      <span aria-hidden="true" className="undo-button-icon">
        <svg viewBox="0 0 24 24">
          <path
            d="M10 7 5 12l5 5M6 12h8a5 5 0 1 1 0 10"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </span>
      <span>{label}</span>
      {count ? <span className="undo-button-count">({count})</span> : null}
    </>
  );
}
