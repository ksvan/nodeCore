"use client";

export function JsonViewerModal({
  title,
  open,
  value,
  onClose,
}: {
  title: string;
  open: boolean;
  value: unknown;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose}>Close</button>
        </div>
        <textarea readOnly rows={18} value={JSON.stringify(value, null, 2)} />
      </div>
    </div>
  );
}
