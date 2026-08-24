import * as fs from 'node:fs';
import * as path from 'node:path';

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

describe('representative theme/token v2 consumers', () => {
  const textSource = source('../../../packages/ui/src/components/text.tsx');
  const buttonSource = source('../../../packages/ui/src/components/button.tsx');
  const inputSource = source('../../../packages/ui/src/components/input.tsx');
  const avatarSource = source('../../../packages/ui/src/components/avatar.tsx');
  const cardSource = source('../../../packages/ui/src/components/card.tsx');
  const inspectorSource = source('../theme-inspector/theme-inspector.tsx');

  it('consumes semantic typography roles instead of the previous numeric Text scale', () => {
    for (const utility of [
      'text-display',
      'text-title',
      'text-heading',
      'text-body',
      'text-label',
      'text-caption',
    ]) {
      expect(textSource).toContain(utility);
    }
    expect(textSource).not.toMatch(/text-(xs|sm|base|lg|2xl)\b/);
  });

  it('consumes control sizing, touch-target, and focus contracts in Button/Input', () => {
    for (const utility of [
      'h-control-compact',
      'h-control-default',
      'h-control-large',
      'ios:min-h-touch-target',
      'android:min-h-touch-target',
      'web:focus-visible:bee-focus-ring',
    ]) {
      expect(`${buttonSource}\n${inputSource}`).toContain(utility);
    }
    expect(buttonSource).toContain('h-control-icon w-control-icon');
  });

  it('consumes semantic avatar and elevation contracts', () => {
    for (const utility of ['h-avatar-sm', 'h-avatar-md', 'h-avatar-lg', 'h-avatar-xl']) {
      expect(avatarSource).toContain(utility);
    }
    expect(cardSource).toContain('shadow-raised');
  });

  it('keeps reusable component source independent from concrete brand identities', () => {
    const representativeComponents = [textSource, buttonSource, inputSource, avatarSource, cardSource].join('\n');
    expect(representativeComponents).not.toMatch(/violet|Brand A|Brand B|resolveBeeRuntimeTheme/);
  });

  it('keeps inspection utilities statically discoverable', () => {
    expect(inspectorSource).not.toMatch(/className=\{`/);
    expect(inspectorSource).toContain("className: 'h-16 rounded-md bg-primary'");
    expect(inspectorSource).toContain('shadow-overlay');
    expect(inspectorSource).toContain('max-w-dialog');
  });
});
