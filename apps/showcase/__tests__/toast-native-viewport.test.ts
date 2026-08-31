import * as fs from 'node:fs';
import * as path from 'node:path';

const toastSource = fs.readFileSync(
  path.resolve(__dirname, '../../../packages/ui/src/components/toast.tsx'),
  'utf8',
);

describe('Toast native viewport layout', () => {
  it('keeps an explicit bottom edge so Android cannot collapse the absolute viewport to zero height', () => {
    const viewportStart = toastSource.indexOf('viewport: {');
    const viewportEnd = toastSource.indexOf('\n  },\n});', viewportStart);

    expect(viewportStart).toBeGreaterThanOrEqual(0);
    expect(viewportEnd).toBeGreaterThan(viewportStart);

    const viewportStyle = toastSource.slice(viewportStart, viewportEnd);
    expect(viewportStyle).toContain("position: 'absolute'");
    expect(viewportStyle).toContain('left: 12');
    expect(viewportStyle).toContain('right: 12');
    expect(viewportStyle).toContain('bottom: 0');
  });

  it('keeps the full-height viewport touch-through while Toast cards remain interactive', () => {
    expect(toastSource).toContain('pointerEvents="box-none"');
  });
});
