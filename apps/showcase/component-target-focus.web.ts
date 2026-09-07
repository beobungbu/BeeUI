type ComponentTargetFocus = {
  focusTestId?: string;
  focusText?: string;
};

function cssString(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function findByExactText(text: string) {
  const escaped = cssString(text);
  const byPlaceholder = document.querySelector<HTMLElement>(
    `input[placeholder="${escaped}"], textarea[placeholder="${escaped}"]`,
  );
  if (byPlaceholder) return byPlaceholder;

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('button, [role="button"], [data-testid], h1, h2, h3, p, span, div'),
  );
  return candidates.find((element) => element.textContent?.trim() === text) ?? null;
}

function clearPreviousTarget() {
  document.querySelectorAll<HTMLElement>('[data-showcase-target-active="true"]').forEach((element) => {
    element.removeAttribute('data-showcase-target-active');
    element.style.removeProperty('outline');
    element.style.removeProperty('outline-offset');
  });
}

export function focusComponentTarget({ focusTestId, focusText }: ComponentTargetFocus) {
  if (typeof document === 'undefined') return () => undefined;

  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    clearPreviousTarget();
    const byTestId = focusTestId
      ? document.querySelector<HTMLElement>(`[data-testid="${cssString(focusTestId)}"]`)
      : null;
    const target = byTestId ?? (focusText ? findByExactText(focusText) : null);
    if (!target) return;

    target.setAttribute('data-showcase-target-active', 'true');
    target.style.outline = '2px solid currentColor';
    target.style.outlineOffset = '4px';
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
  };

  const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(run));
  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frame);
    clearPreviousTarget();
  };
}
