const VISIBLE = 3;

/** Comma-separated roles; more than three collapse behind "+N more". */
export function RolesCell({ roles, suffix }: { roles: string[]; suffix?: React.ReactNode }) {
  if (roles.length <= VISIBLE) {
    return (
      <>
        {roles.join(", ")}
        {suffix}
      </>
    );
  }
  const shown = roles.slice(0, VISIBLE);
  const rest = roles.slice(VISIBLE);
  return (
    <details className="inline">
      <summary className="cursor-pointer list-none">
        {shown.join(", ")}
        <span className="ml-1 text-xs text-accent">+{rest.length} more</span>
        {suffix}
      </summary>
      <ul className="mt-1 ml-3 list-disc text-xs">
        {roles.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </details>
  );
}
