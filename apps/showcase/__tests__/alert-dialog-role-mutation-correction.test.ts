import { watchAlertDialogRole } from '../../../packages/ui/src/components/alert-dialog-role-watch';

// A minimal structural stand-in for the DOM node `watchAlertDialogRole`
// corrects, and for the global `MutationObserver` it feeds — this repo's Jest
// harness (`jest-expo`, `react-test-renderer`) has no real DOM/browser
// `MutationObserver`, so this proves the wiring logic itself (which
// attribute it watches, how it reacts) in isolation from React rendering and
// from react-native-web's real runtime behavior, which only a real browser
// (`apps/visual-regression`) can exercise end to end.
function createFakeRoleNode(initialRole: string | null) {
  let role = initialRole;
  return {
    getAttribute: (name: string) => (name === 'role' ? role : null),
    setAttribute: (name: string, value: string) => {
      if (name === 'role') role = value;
    },
  };
}

function createFakeMutationObserverCtor() {
  const instances: {
    callback: () => void;
    disconnect: jest.Mock;
    observeArgs: unknown[];
  }[] = [];

  class FakeMutationObserver {
    private readonly callback: () => void;
    disconnect = jest.fn();

    constructor(callback: () => void) {
      this.callback = callback;
    }

    observe(...args: unknown[]) {
      instances.push({ callback: this.callback, disconnect: this.disconnect, observeArgs: args });
    }
  }

  return { FakeMutationObserver, instances };
}

describe('watchAlertDialogRole', () => {
  it('corrects the role to "alertdialog" immediately, even if the node currently has none', () => {
    const node = createFakeRoleNode(null);
    const { FakeMutationObserver } = createFakeMutationObserverCtor();

    watchAlertDialogRole(node, FakeMutationObserver);

    expect(node.getAttribute('role')).toBe('alertdialog');
  });

  it('observes only the "role" attribute on the given node', () => {
    const node = createFakeRoleNode(null);
    const { FakeMutationObserver, instances } = createFakeMutationObserverCtor();

    watchAlertDialogRole(node, FakeMutationObserver);

    expect(instances).toHaveLength(1);
    expect(instances[0].observeArgs).toEqual([
      node,
      { attributeFilter: ['role'], attributes: true },
    ]);
  });

  it('re-corrects the role back to "alertdialog" whenever react-native-web overwrites it (simulating its own re-render)', () => {
    const node = createFakeRoleNode(null);
    const { FakeMutationObserver, instances } = createFakeMutationObserverCtor();

    watchAlertDialogRole(node, FakeMutationObserver);
    expect(node.getAttribute('role')).toBe('alertdialog');

    // Simulate react-native-web's own forced re-render overwriting the
    // attribute back to "dialog", then firing the MutationObserver callback
    // the same way a real DOM mutation would.
    node.setAttribute('role', 'dialog');
    instances[0].callback();

    expect(node.getAttribute('role')).toBe('alertdialog');
  });

  it('does not call setAttribute again once the role already reads "alertdialog" (no redundant writes)', () => {
    const node = createFakeRoleNode('alertdialog');
    const setAttributeSpy = jest.spyOn(node, 'setAttribute');
    const { FakeMutationObserver, instances } = createFakeMutationObserverCtor();

    watchAlertDialogRole(node, FakeMutationObserver);
    instances[0].callback();

    expect(setAttributeSpy).not.toHaveBeenCalled();
  });

  it('stops correcting once the returned cleanup disconnects the observer', () => {
    const node = createFakeRoleNode(null);
    const { FakeMutationObserver, instances } = createFakeMutationObserverCtor();

    const stop = watchAlertDialogRole(node, FakeMutationObserver);
    stop();

    expect(instances[0].disconnect).toHaveBeenCalledTimes(1);
  });
});
