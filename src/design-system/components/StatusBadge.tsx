type Tone = 'active' | 'inactive' | 'warning' | 'error';

const ICON: Record<Tone, string> = { active: '●', inactive: '○', warning: '▲', error: '⚠' };

/** State is conveyed by text and icon, never color alone (docs/ux/design-system.md). */
export function StatusBadge({ tone, children }: { tone: Tone; children: string }) {
  return (
    <p className={`status status--${tone}`} role="status" aria-live="polite">
      <span aria-hidden="true">{ICON[tone]}</span> {children}
    </p>
  );
}
