export function CellHierarchy() {
  return (
    <div className="cell-hierarchy">
      <div style={{ padding: "8px", color: "var(--os-fg-muted)", fontSize: "var(--os-font-size-sm)" }}>
        <p style={{ marginBottom: "8px" }}>No project loaded.</p>
        <p>Open a GDS-II or .osproj file to view the cell hierarchy.</p>
      </div>
    </div>
  );
}
