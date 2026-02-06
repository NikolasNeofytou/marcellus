export function ComponentLibrary() {
  return (
    <div className="component-library">
      <div style={{ padding: "8px", color: "var(--os-fg-muted)", fontSize: "var(--os-font-size-sm)" }}>
        <p style={{ marginBottom: "8px" }}>No PDK loaded.</p>
        <p>Install a PDK plugin (e.g., SKY130) to access standard cells and device templates.</p>
      </div>
    </div>
  );
}
