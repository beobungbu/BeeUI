/**
 * Declared example coverage for the public component families.
 *
 * Kept in its own dependency-free module so the documentation generators can read the same
 * table the runtime Showcase uses; example-registry.ts pulls in the Pattern Gallery (and
 * therefore React components), which Node-based generators cannot load.
 */

export type ExampleCoverageClass =
  | 'basic'
  | 'variants'
  | 'states'
  | 'controlled'
  | 'uncontrolled'
  | 'composition'
  | 'accessibility'
  | 'platform'
  | 'production';

export type CoverageFocus = {
  focusTestId?: string;
  focusText?: string;
};

/**
 * Declared coverage for every public component family.
 *
 * One class is claimed only when a distinct, addressable example for it actually exists in
 * the component's fixture. That is deliberate: #472 requires applicability to be explicit and
 * mechanically reviewable "so a complex component cannot satisfy coverage with one trivial
 * default sample". Deriving coverage from heuristics produced rows whose targets all collapsed
 * onto the same element, so the class list is now the data and `check-example-registry.mjs`
 * fails when two claimed classes resolve to the same target.
 *
 * Where a class from #472 section 2 is not claimed for a component in its complex review set,
 * COVERAGE_RATIONALE states why, so the absence is reviewable instead of silent.
 */
export const COMPONENT_COVERAGE: Readonly<
  Record<string, Readonly<Partial<Record<ExampleCoverageClass, CoverageFocus>>>>
> = {
  accordion: { basic: { focusText: 'Account' }, states: { focusText: 'Billing' } },
  'alert-banner': { basic: { focusText: 'Hands-on playground' } },
  'alert-dialog': { basic: { focusText: 'Delete project' } },
  'app-header': { basic: { focusTestId: 'component-gallery-header' } },
  avatar: { basic: { focusText: 'BU' } },
  badge: { basic: { focusText: 'Primary' }, variants: { focusText: 'Info' } },
  'bottom-action-bar': { basic: { focusText: 'Save changes' } },
  box: { basic: { focusText: 'Foundation' } },
  breadcrumb: { basic: { focusText: 'Projects' }, states: { focusText: 'BeeUI' } },
  button: {
    basic: { focusText: 'Primary action' },
    variants: { focusText: 'Destructive action' },
    states: { focusText: 'Loading action' },
  },
  calendar: { basic: { focusText: 'Calendar' } },
  card: { basic: { focusText: 'Actions' } },
  checkbox: {
    basic: { focusText: 'Accept terms' },
    states: { focusTestId: 'checkbox-managed-state' },
  },
  chip: { basic: { focusText: 'Mobile' } },
  collapsible: { basic: { focusText: 'Advanced options' } },
  'date-picker': { basic: { focusText: 'DatePicker' } },
  'date-time-picker': { basic: { focusText: 'DateTimePicker' } },
  'description-list': {
    basic: { focusText: 'Runtime' },
    composition: { focusText: 'Native verification' },
  },
  dialog: { basic: { focusText: 'Open Dialog' } },
  'dropdown-menu': {
    basic: { focusText: 'Workspace menu' },
    composition: { focusTestId: 'overlay-context-menu-trigger' },
  },
  field: {
    basic: { focusTestId: 'component-gallery-field' },
    states: { focusTestId: 'field-invalid-state' },
    accessibility: { focusTestId: 'field-disabled-state' },
    composition: { focusTestId: 'field-otp-composition' },
  },
  'form-group': { basic: { focusText: 'Subscription plan' } },
  'form-message': { basic: { focusText: 'Example validation message' } },
  'icon-button': { basic: { focusText: '＋' } },
  input: {
    basic: { focusText: 'you@example.com' },
    states: { focusText: 'Invalid value' },
  },
  'keyboard-aware-screen': { basic: { focusTestId: 'keyboard-aware-screen-exact-fixture' } },
  label: { basic: { focusText: 'Project name' } },
  link: { basic: { focusText: 'Open documentation' } },
  'list-group': { basic: { focusText: 'Workspace' } },
  'list-item': { basic: { focusText: 'Profile' }, composition: { focusText: 'BeeUI' } },
  'metadata-row': { basic: { focusText: 'colors.primary' } },
  'otp-input': { basic: { focusText: 'Verification code' } },
  pagination: {
    basic: { focusText: 'Page' },
    states: { focusTestId: 'pagination-previous' },
  },
  'password-input': { basic: { focusText: 'Password' } },
  popover: {
    basic: { focusText: 'bottom' },
    states: { focusText: 'Near right edge' },
    composition: { focusText: 'Open parent' },
  },
  progress: { basic: { focusText: 'Status and feedback' } },
  radio: { basic: { focusText: 'Starter plan' } },
  'safe-area': { basic: { focusTestId: 'component-gallery-safe-area' } },
  screen: { basic: { focusTestId: 'component-gallery' } },
  'search-input': { basic: { focusText: 'Search' } },
  section: { basic: { focusText: 'Actions' } },
  'segmented-control': { basic: { focusText: 'View' } },
  // `basic` is the controlled Select, so a separate `controlled` class would address the same
  // example. The fixture's genuinely distinct examples are the four claimed here.
  select: {
    basic: { focusTestId: 'select-showcase-controlled-trigger' },
    states: { focusTestId: 'select-showcase-disabled-trigger' },
    uncontrolled: { focusTestId: 'select-showcase-placeholder-trigger' },
    composition: { focusTestId: 'select-showcase-group-trigger' },
  },
  separator: { basic: { focusText: 'Status and feedback' } },
  sheet: { basic: { focusTestId: 'sheet-demo-trigger' } },
  skeleton: { basic: { focusText: 'Loading and state surfaces' } },
  spinner: {
    basic: { focusTestId: 'spinner-default' },
    variants: { focusTestId: 'spinner-destructive' },
  },
  stack: { basic: { focusText: 'Application composition' } },
  stat: { basic: { focusText: 'API surface' } },
  'state-message': {
    basic: { focusText: 'No records yet' },
    states: { focusText: 'The server could not load this section.' },
  },
  stepper: { basic: { focusTestId: 'stepper-showcase' } },
  switch: {
    basic: { focusText: 'Notifications' },
    composition: { focusText: 'Push notifications' },
  },
  table: {
    basic: { focusTestId: 'table-showcase' },
    states: { focusTestId: 'table-showcase-stacked' },
  },
  tabs: { basic: { focusText: 'Overview' }, states: { focusText: 'Details' } },
  text: { basic: { focusText: 'Component Gallery' } },
  textarea: { basic: { focusText: 'Notes' } },
  'theme-scope': { basic: { focusText: 'Scoped theme (BeeThemeScope)' } },
  timeline: {
    basic: { focusText: 'Native portability' },
    states: { focusText: 'Anchored overlays' },
  },
  toast: {
    basic: { focusText: 'Default' },
    states: { focusText: 'Error' },
    accessibility: { focusText: 'Persistent' },
    composition: { focusText: 'Action' },
  },
  tooltip: { basic: { focusTestId: 'tooltip-demo-trigger' } },
  'use-bee-token': { basic: { focusTestId: 'use-bee-token-value' } },
  'visually-hidden': {
    basic: { focusText: 'Visible companion text for the assistive-only content rendered immediately after it.' },
  },
};

/**
 * Why a component in #472's complex review set does not claim every example class.
 *
 * The recurring reason is addressability: an overlay's states/composition live inside content
 * that is not mounted until the trigger is activated, so a second claimed class would resolve
 * to the same trigger element as `basic` and prove nothing. Closing these needs new fixtures,
 * not a wider claim, and is tracked as follow-up rather than asserted here.
 */
export const COVERAGE_RATIONALE: Readonly<Record<string, string>> = {
  'alert-dialog': 'Confirmation content mounts only while open; the single trigger is the one addressable target.',
  calendar: 'One controlled Calendar fixture; day-cell state is internal to the grid rather than a separate example.',
  checkbox: 'Controlled and uncontrolled Checkbox render the same control; only enabled vs managed state is separately addressable.',
  'date-picker': 'Trigger opens a Popover on Web and the system picker on native, so states/platform have no second addressable trigger.',
  'date-time-picker': 'Same trigger-only addressability as DatePicker, plus a native chained picker with no Web equivalent to address.',
  dialog: 'Dialog content, footer composition and focus behavior mount only while open; the trigger is the one addressable target.',
  input: 'Controlled and accessibility behavior is exercised through Field; Input itself exposes default and invalid targets.',
  'otp-input': 'One six-digit fixture; per-slot state is internal to the control rather than a separate example.',
  'password-input': 'One fixture; reveal state is an internal toggle rather than a separately addressable example.',
  radio: 'Radio state is owned by the enclosing RadioGroup, so individual radios are not separate coverage classes.',
  sheet: 'Sheet content mounts only while open; the single trigger is the one addressable target.',
  tooltip: 'Tooltip content is deliberately not a focus target and mounts only on hover/focus intent.',
};


/** The coverage classes a component claims, in declaration order. */
export function coverageForComponent(ownerId: string): readonly ExampleCoverageClass[] {
  return Object.keys(COMPONENT_COVERAGE[ownerId] ?? { basic: {} }) as ExampleCoverageClass[];
}
