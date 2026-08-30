/**
 * BeeUI 1.0 #144 (R3.6) — localization / long-content stress fixtures.
 *
 * Shared fixture module consumed by the runtime fixture screen
 * (`l10n-stress-acceptance.tsx`) and reusable by a future component's own
 * test file (`L10N_STRESS_PROFILES`/`pseudoLocalize`) instead of re-deriving
 * stress strings. Deliberately colocated in `runtime-smoke/` rather than
 * `apps/showcase/__tests__/helpers/` (unlike #143's `dynamic-type.ts`):
 * Metro's Web bundler cannot resolve imports from `__tests__/` directories
 * into app code, so a module the running Showcase app itself imports must
 * live outside that tree.
 *
 * Five profiles cover the axes #144's issue body enumerates: a long English
 * sentence plus a real long German compound word (the "long words" axis), a
 * real Japanese (CJK) profile with no natural word-break opportunities, a
 * Vietnamese profile (diacritics, still Latin-script wrapping), a real Arabic
 * profile (RTL script + Arabic-indic numerals), and a pseudo-localized
 * profile derived mechanically from the long-English base string via
 * `pseudoLocalize()`.
 *
 * `dir` records each profile's natural script direction. This module does
 * **not** implement or duplicate BeeUI's direction-resolution authority
 * (ADR-004, `docs/decisions/004-direction-architecture.md`) — the Arabic
 * profile's Web RTL exercise reuses the same `document.documentElement.dir`
 * ambient-authority seam #140/#141/#142 already established
 * (`apps/visual-regression/tests/overlay-rtl-showcase.spec.ts`'s `setRtl()`);
 * `dir` here is only used to decide *when* a spec should flip that seam for a
 * given profile's content, never to re-derive layout mirroring itself.
 */

export type L10nStressProfileId = 'long-en' | 'cjk' | 'vi' | 'ar-rtl' | 'pseudo';

export type L10nStressProfile = {
  /** Real-world equivalent this profile stands in for. */
  description: string;
  /** Natural script direction of this profile's content. */
  dir: 'ltr' | 'rtl';
  /** A representative long/realistic email address (kept ASCII — most real-world email
   * addresses are ASCII regardless of the account holder's locale; the length/realism
   * stress lives in the local+domain parts, not the script). */
  email: string;
  /** A large, locale-formatted numeric/finance value (thousands separators, currency,
   * and digit script vary by locale on purpose). */
  financeAmount: string;
  id: L10nStressProfileId;
  /** A realistic long invoice/reference identifier. */
  identifier: string;
  /** A single long, unbroken token (no spaces) representative of the "long words"
   * axis — compound words (German), or scripts without space-delimited breaking (CJK). */
  longWord: string;
  label: string;
  /** A realistic full name, long enough to stress single-line rows. */
  personName: string;
  /** A realistic multi-clause sentence long enough to force wrapping in a normal-width
   * column/field. */
  sentence: string;
  /** A representative user-facing message, sized like a real Toast/notification body. */
  toastMessage: string;
};

const PSEUDO_ACCENT_MAP: Record<string, string> = {
  A: 'Ä',
  E: 'Ë',
  I: 'Ï',
  O: 'Ö',
  U: 'Ü',
  a: 'ä',
  e: 'ë',
  i: 'ï',
  o: 'ö',
  u: 'ü',
};

/**
 * Standard pseudo-localization transform: accents every vowel (proves the UI survives
 * diacritics/character-width drift) and appends `~`-padding proportional to
 * `expansionFactor` (proves the UI survives the ~30-50% length expansion real
 * translated strings commonly produce), wrapped in brackets so truncation/clipping is
 * visually obvious in a screenshot ("[...]" surviving intact means no clip).
 */
export function pseudoLocalize(text: string, expansionFactor = 0.4): string {
  const accented = text.replace(/[aeiouAEIOU]/g, (char) => PSEUDO_ACCENT_MAP[char] ?? char);
  const padding = '~'.repeat(Math.ceil(text.length * expansionFactor));
  return `[${accented}${padding}]`;
}

const LONG_EN_SENTENCE =
  'The quarterly compliance resubmission for every internationally registered holding subsidiary must be finalized and independently reviewed before the regulatory deadline expires without exception or extension.';

export const L10N_STRESS_PROFILES: Record<L10nStressProfileId, L10nStressProfile> = {
  'long-en': {
    description: 'Long English sentence + a real long German compound word',
    dir: 'ltr',
    email: 'bartholomew.christiansen.abernathy.worthington@international-holdings-conglomerate.example.com',
    financeAmount: '$1,234,567,890,123.45',
    id: 'long-en',
    identifier: 'INV-2026-Q1-EMEA-WESTERN-REGION-00000012345678-FINAL',
    longWord: 'Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz',
    label: 'Long English / German compound',
    personName: 'Bartholomew Christiansen-Abernathy-Worthington III',
    sentence: LONG_EN_SENTENCE,
    toastMessage:
      'Your quarterly compliance resubmission has been received and archived for independent review before the regulatory deadline.',
  },
  cjk: {
    description: 'Japanese (CJK): no natural word-break opportunities',
    dir: 'ltr',
    email: 'tanaka.taro.kokusai-butsuryu@kokusai-butsuryu-kk.example.jp',
    financeAmount: '￥123,456,789,012',
    id: 'cjk',
    identifier: '請求書番号-二〇二六年第一四半期-特別会計区分-〇〇〇四五六七',
    longWord: '国際物流株式会社特別会計区分番号関連書類提出期限通知書',
    label: 'CJK (Japanese)',
    personName: '田中太郎国際物流株式会社代表取締役社長',
    sentence: '本四半期の財務諸表は監査委員会による最終承認を得るまで公開ウェブサイトに掲載することはできません。',
    toastMessage: '四半期報告書の提出が正常に完了しました。内容をご確認ください。',
  },
  vi: {
    description: 'Vietnamese: Latin-script diacritics, still space-delimited wrapping',
    dir: 'ltr',
    email: 'nguyen.thi.thanh.huong.dang.tran.bao.ngoc@dautu-phattrien-quocte.example.vn',
    financeAmount: '123.456.789.012 ₫',
    id: 'vi',
    identifier: 'HĐ-2026-QUY1-KHUVUCMIENTRUNG-SO-0004567',
    longWord: 'Nghiêngnghiêngkhôngdấucáchđượcviếtliềnnhauđểkiểmtra',
    label: 'Vietnamese',
    personName: 'Nguyễn Thị Thanh Hương Đặng Trần Bảo Ngọc',
    sentence:
      'Công ty Trách nhiệm hữu hạn Một thành viên Đầu tư và Phát triển Bất động sản Quốc tế Việt Nam yêu cầu quý khách xác nhận lại thông tin tài khoản trước khi thời hạn đăng ký kết thúc.',
    toastMessage:
      'Yêu cầu xác nhận lại thông tin tài khoản của bạn đã được gửi thành công đến địa chỉ email đã đăng ký.',
  },
  'ar-rtl': {
    description: 'Arabic: RTL script, Arabic-indic numerals',
    dir: 'rtl',
    email: 'abdulrahman.alsaud@finance-authority.example.sa',
    financeAmount: '١٬٢٣٤٬٥٦٧٫٤٥ ر.س',
    id: 'ar-rtl',
    identifier: 'رقم-الفاتورة-٢٠٢٦-الربع الأول-٠٠٠٤٥٦٧',
    longWord: 'استمارةطلبالحصولعلىترخيصمزاولةنشاطتجاري',
    label: 'Arabic (RTL)',
    personName: 'عبدالرحمن بن محمد آل سعود الفهد',
    sentence:
      'يجب على جميع الشركات المسجلة تقديم البيانات المالية ربع السنوية قبل الموعد النهائي المحدد من الجهة المختصة.',
    toastMessage: 'تم إرسال طلب التحقق من معلومات حسابك بنجاح إلى عنوان البريد الإلكتروني المسجل.',
  },
  pseudo: {
    description: 'Pseudo-localization: mechanical accent + length expansion of the long-English base',
    dir: 'ltr',
    email: pseudoLocalize('bartholomew.worthington@example.com', 0.3),
    financeAmount: pseudoLocalize('$1,234,567.45', 0.3),
    id: 'pseudo',
    identifier: pseudoLocalize('INV-2026-Q1-00012345', 0.3),
    longWord: pseudoLocalize('Confirmation', 0.6),
    label: 'Pseudo-localized',
    personName: pseudoLocalize('Bartholomew Christiansen', 0.3),
    sentence: pseudoLocalize(LONG_EN_SENTENCE, 0.4),
    toastMessage: pseudoLocalize(
      'Your quarterly compliance resubmission has been received and archived for independent review.',
      0.4,
    ),
  },
};

export const L10N_STRESS_PROFILE_IDS: L10nStressProfileId[] = [
  'long-en',
  'cjk',
  'vi',
  'ar-rtl',
  'pseudo',
];
