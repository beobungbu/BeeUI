import { cn } from '@beeui/core';
import { buttonLabelVariants, textVariants } from '@beeui/ui';
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

  it('consumes semantic typography variables instead of the previous numeric Text scale', () => {
    for (const role of ['display', 'title', 'heading', 'body', 'label', 'caption']) {
      expect(textSource).toContain(`text-[length:var(--text-${role})]`);
      expect(textSource).toContain(`leading-[var(--text-${role}--line-height)]`);
    }
    expect(textSource).not.toMatch(/text-(xs|sm|base|lg|2xl)\b/);
  });

  it('keeps semantic typography and semantic colors in separate tailwind-merge groups', () => {
    const titleWithTone = cn(textVariants({ variant: 'title' }), 'text-success');
    expect(titleWithTone).toContain('text-[length:var(--text-title)]');
    expect(titleWithTone).toContain('leading-[var(--text-title--line-height)]');
    expect(titleWithTone).toContain('text-success');

    const destructiveLabel = cn(buttonLabelVariants({ variant: 'destructive', size: 'md' }));
    expect(destructiveLabel).toContain('text-[length:var(--text-label)]');
    expect(destructiveLabel).toContain('leading-[var(--text-label--line-height)]');
    expect(destructiveLabel).toContain('text-destructive-foreground');
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
