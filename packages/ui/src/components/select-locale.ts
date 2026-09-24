import { DEFAULT_CALENDAR_LOCALE } from './calendar-locale';

// `SelectValue`'s built-in placeholder, used only when the caller passes no `placeholder`.
// Same contract as `DatePicker`'s default placeholder (`date-picker-locale.ts`, ADR-008):
// the locale is explicit-only (the `Select` root's `locale` prop, never an ambient device or
// browser read), a small built-in dictionary covers the locales BeeUI consumers ship, and an
// unknown locale falls back to the English copy. A caller-supplied `placeholder` always wins.
const SELECT_PLACEHOLDER_BY_LOCALE: Record<string, string> = {
  'en-US': 'Select an option',
  'vi-VN': 'Chọn một mục',
};

/**
 * Locale-appropriate default for `SelectValue`'s `placeholder`, used only when the caller
 * omits `placeholder`. Falls back to the `'en-US'` copy for a `locale` this built-in
 * dictionary does not cover.
 */
export function getSelectDefaultPlaceholder(locale: string = DEFAULT_CALENDAR_LOCALE): string {
  return SELECT_PLACEHOLDER_BY_LOCALE[locale] ?? SELECT_PLACEHOLDER_BY_LOCALE[DEFAULT_CALENDAR_LOCALE];
}
