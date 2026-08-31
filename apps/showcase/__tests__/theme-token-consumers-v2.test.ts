import { cn } from '@beemvp/beeui-core';
import { lineHeight } from '@beemvp/beeui-tokens';
import { buttonLabelVariants, buttonVariants, inputVariants, textVariants } from '@beemvp/beeui-ui';
import { getTextareaWebMinHeight } from '../../../packages/ui/src/components/textarea';
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

    const defaultInput = cn(inputVariants({ size: 'md', invalid: false }));
    expect(defaultInput).toContain('text-[length:var(--text-body)]');
    expect(defaultInput).toContain('leading-6');
    expect(defaultInput).not.toContain('leading-[var(--text-body--line-height)]');
    expect(defaultInput).toContain('text-foreground');
  });

  it('preserves Textarea numberOfLines geometry on web', () => {
    expect(getTextareaWebMinHeight(2)).toBe(96);
    expect(getTextareaWebMinHeight(4)).toBe(lineHeight.body * 4 + 26);
    expect(getTextareaWebMinHeight(6)).toBe(lineHeight.body * 6 + 26);
    expect(getTextareaWebMinHeight(6)).toBeGreaterThan(getTextareaWebMinHeight(4));
  });

  it('consumes control sizing, touch-target, focus, and boundary contracts in Button/Input', () => {
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

    const defaultInput = inputVariants({ size: 'md', invalid: false });
    expect(defaultInput).toContain('border-control-border');
    expect(defaultInput).not.toContain('border-border-strong');
    expect(defaultInput).toContain('focus:border-focus-ring');

    const invalidInput = inputVariants({ size: 'md', invalid: true });
    expect(invalidInput).toContain('border-destructive');
    expect(invalidInput).toContain('focus:border-destructive');

    expect(inputSource).toContain(
      "'border-control-border bg-disabled text-disabled-foreground opacity-70'",
    );
  });

  it('uses explicit semantic filled Button interaction states instead of active opacity', () => {
    const primary = buttonVariants({ variant: 'primary', size: 'md' });
    expect(primary).toContain('bg-primary');
    expect(primary).toContain('web:hover:bg-primary-hover');
    expect(primary).toContain('active:bg-primary-pressed');

    const secondary = buttonVariants({ variant: 'secondary', size: 'md' });
    expect(secondary).toContain('bg-secondary');
    expect(secondary).toContain('web:hover:bg-secondary-hover');
    expect(secondary).toContain('active:bg-secondary-pressed');

    const destructive = buttonVariants({ variant: 'destructive', size: 'md' });
    expect(destructive).toContain('bg-destructive');
    expect(destructive).toContain('web:hover:bg-destructive-hover');
    expect(destructive).toContain('active:bg-destructive-pressed');

    for (const filledVariant of [primary, secondary, destructive]) {
      expect(filledVariant).not.toMatch(/active:opacity-/);
    }

    expect(buttonVariants({ variant: 'outline', size: 'md' })).toContain('active:bg-muted');
    expect(buttonVariants({ variant: 'ghost', size: 'md' })).toContain('active:bg-muted');
    expect(buttonSource).toContain("isDisabled && 'border-disabled bg-disabled opacity-60'");
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
