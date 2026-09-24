import { render } from '@testing-library/react-native';

/**
 * Renders under the suite's mocked gorhom `BottomSheetModalProvider`.
 *
 * Every app mounts gorhom's modal provider above a native Sheet (`SheetProvider` installs
 * it); without one gorhom's `BottomSheetModal` throws and BeeUI renders nothing. Suites
 * that prove Sheet behavior around a mounted modal use this wrapper; provider absence is
 * covered by `sheet-native-provider-fail-soft.test.tsx`. The calling suite's
 * `jest.mock('@gorhom/bottom-sheet')` must export `BottomSheetModalProvider`.
 */
export function renderWithModalProvider(
  ui: Parameters<typeof render>[0],
  options?: Omit<NonNullable<Parameters<typeof render>[1]>, 'wrapper'>,
) {
  const { BottomSheetModalProvider } = require('@gorhom/bottom-sheet');
  return render(ui, { ...options, wrapper: BottomSheetModalProvider });
}
