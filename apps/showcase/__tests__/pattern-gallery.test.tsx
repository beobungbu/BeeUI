import * as fs from 'node:fs';
import * as path from 'node:path';
import { fireEvent, render } from '@testing-library/react-native';
import { BeeUIProvider } from '@beeui/ui';
import * as React from 'react';
import type * as ReactTypes from 'react';
import { Uniwind } from 'uniwind';
import {
  PatternGallery,
  defaultPatternState,
  patternCatalog,
  patternScreens,
} from '../pattern-gallery';

let mockDimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    useWindowDimensions: () => mockDimensions,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: ReactTypes.ReactNode }) => children,
    SafeAreaListener: ({
      children,
      onChange,
    }: {
      children?: ReactTypes.ReactNode;
      onChange: (metrics: { frame: typeof frame; insets: typeof insets }) => void;
    }) => {
      React.useEffect(() => {
        onChange({ frame, insets });
      }, [onChange]);
      return children;
    },
    SafeAreaView: React.forwardRef(
      (
        { children, ...props }: { children?: ReactTypes.ReactNode },
        ref: ReactTypes.ForwardedRef<ReactTypes.ComponentRef<typeof View>>,
      ) => (
        <View ref={ref} {...props}>
          {children}
        </View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

function renderGallery() {
  return render(
    <BeeUIProvider>
      <PatternGallery />
    </BeeUIProvider>,
  );
}

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.tsx?$/.test(entry.name) ? [fullPath] : [];
  });
}

function productionScreenFiles(): string[] {
  const patternRoot = path.resolve(__dirname, '../patterns');
  return fs.readdirSync(patternRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const screensRoot = path.join(patternRoot, entry.name, 'screens');
      if (!fs.existsSync(screensRoot)) return [];
      return fs.readdirSync(screensRoot)
        .filter((name) => /-screen\.tsx$/.test(name))
        .map((name) => path.join(screensRoot, name));
    })
    .sort();
}

function productionScreenExport(file: string): React.ElementType {
  const moduleExports = require(file) as Record<string, unknown>;
  const screenExports = Object.entries(moduleExports).filter(
    ([name, value]) => name.endsWith('Screen') && typeof value === 'function',
  );
  expect(screenExports).toHaveLength(1);
  return screenExports[0][1] as React.ElementType;
}

describe('Showcase Pattern Gallery', () => {
  beforeEach(() => {
    mockDimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };
  });

  it('registers exactly four domains and the current 37-screen inventory with unique IDs', () => {
    expect(patternCatalog).toHaveLength(4);
    expect(patternCatalog.map((domain) => domain.screens.length)).toEqual([9, 8, 12, 8]);
    expect(patternScreens).toHaveLength(37);

    const domainIds = patternCatalog.map((domain) => domain.id);
    const screenIds = patternScreens.map((screen) => screen.id);
    expect(new Set(domainIds).size).toBe(domainIds.length);
    expect(new Set(screenIds).size).toBe(screenIds.length);
    patternScreens.forEach((screen) => {
      expect(screen.title.trim().length).toBeGreaterThan(0);
      expect(typeof screen.component).toBe('function');
      expect(screen.source).toBeTruthy();
    });
  });

  it('discovers production screens from the filesystem and maps every implementation exactly once', () => {
    const inventoryFiles = productionScreenFiles();
    const inventorySources = inventoryFiles.map(productionScreenExport);
    const gallerySources = patternScreens.map((screen) => screen.source);

    expect(inventoryFiles).toHaveLength(37);
    expect(new Set(inventorySources).size).toBe(inventorySources.length);
    expect(new Set(gallerySources).size).toBe(gallerySources.length);
    expect(gallerySources).toHaveLength(inventorySources.length);

    for (const source of inventorySources) {
      expect(gallerySources.filter((candidate) => candidate === source)).toHaveLength(1);
    }
    for (const source of gallerySources) {
      expect(inventorySources).toContain(source);
    }
  });

  it('renders all domains on the gallery home', () => {
    const view = renderGallery();
    patternCatalog.forEach((domain) => {
      expect(view.getByText(domain.title)).toBeTruthy();
      expect(view.getByRole('button', { name: `Open ${domain.title}` })).toBeTruthy();
    });
  });

  it('navigates home to domain to screen and back again', () => {
    const view = renderGallery();
    fireEvent.press(view.getByRole('button', { name: 'Open Authentication & Onboarding' }));
    expect(view.getByText('Choose a screen')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Open Sign In pattern' })).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Open Sign In pattern' }));
    expect(view.getByTestId('pattern-preview-sign-in')).toBeTruthy();
    expect(view.getByDisplayValue('lan@example.com')).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Back to domain screen list' }));
    expect(view.getByText('Choose a screen')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Back to pattern domains' }));
    expect(view.getByText('Production patterns')).toBeTruthy();
  });

  it('resets controlled demo state when a screen is reopened', () => {
    const view = renderGallery();
    fireEvent.press(view.getByRole('button', { name: 'Open Authentication & Onboarding' }));
    fireEvent.press(view.getByRole('button', { name: 'Open Sign In pattern' }));

    fireEvent.changeText(view.getByPlaceholderText('you@example.com'), 'changed@example.com');
    expect(view.getByDisplayValue('changed@example.com')).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Back to domain screen list' }));
    fireEvent.press(view.getByRole('button', { name: 'Open Sign In pattern' }));
    expect(view.getByDisplayValue('lan@example.com')).toBeTruthy();
  });

  it('switches representative screen state through the gallery selector', () => {
    const view = renderGallery();
    fireEvent.press(view.getByRole('button', { name: 'Open Authentication & Onboarding' }));
    fireEvent.press(view.getByRole('button', { name: 'Open Sign In pattern' }));
    fireEvent.press(view.getByRole('button', { name: 'Show Server error state' }));

    expect(view.getByText('The account could not be authenticated.')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Show Server error state' }).props.accessibilityState.selected).toBe(true);
  });

  it('exposes selected domain, screen, and state semantics on desktop', () => {
    mockDimensions = { width: 1280, height: 800, scale: 1, fontScale: 1 };
    const view = renderGallery();
    fireEvent.press(view.getByRole('button', { name: 'Open Authentication & Onboarding' }));
    fireEvent.press(view.getByRole('button', { name: 'Open Sign In pattern' }));

    expect(view.getByRole('button', { name: 'Switch to Authentication & Onboarding' }).props.accessibilityState.selected).toBe(true);
    expect(view.getByRole('button', { name: 'Open Sign In pattern' }).props.accessibilityState.selected).toBe(true);
    expect(view.getByRole('button', { name: 'Show Default state' }).props.accessibilityState.selected).toBe(true);
  });

  it('exposes a working gallery theme control', () => {
    const setTheme = jest.fn();
    (Uniwind as typeof Uniwind & { setTheme: typeof setTheme }).setTheme = setTheme;
    const view = renderGallery();

    fireEvent.press(view.getByRole('button', { name: 'Theme light. Switch to dark' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('renders every registered adapter without throwing', () => {
    for (const screen of patternScreens) {
      const Demo = screen.component;
      const view = render(
        <BeeUIProvider>
          <Demo stateId={defaultPatternState(screen)} />
        </BeeUIProvider>,
      );
      expect(view.toJSON()).toBeTruthy();
      view.unmount();
    }
  });

  it('keeps Showcase imports public and router-free', () => {
    const roots = [
      path.resolve(__dirname, '../pattern-gallery'),
      path.resolve(__dirname, '../component-gallery'),
    ];
    const files = [
      ...roots.flatMap(sourceFiles),
      path.resolve(__dirname, '../showcase-root.tsx'),
      path.resolve(__dirname, '../App.tsx'),
    ];
    const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

    expect(source).not.toMatch(/from ['"]@beeui\/ui\//);
    expect(source).not.toMatch(/packages\/(?:ui|core)\/src\//);
    expect(source).not.toMatch(/overlay-runtime/);
    expect(source).not.toMatch(/from ['"](?:expo-router|@react-navigation|react-router)/);
  });
});
