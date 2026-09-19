import { watchDialogOwnerRole } from '../../../packages/ui/src/components/dialog-role-watch';

// A minimal structural stand-in for the DOM node `watchDialogOwnerRole`
// stamps, and for the global `MutationObserver` it feeds — this repo's Jest
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

describe.each(['dialog', 'alertdialog'] as const)('watchDialogOwnerRole(%s)', (role) => {
  it('stamps the role immediately, even if the node currently has none (react-native-web has not activated yet)', () => {
    const node = createFakeRoleNode(null);
    const { FakeMutationObserver } = createFakeMutationObserverCtor();

    watchDialogOwnerRole(node, role, FakeMutationObserver);

    expect(node.getAttribute('role')).toBe(role);
  });

  it('observes only the "role" attribute on the given node', () => {
    const node = createFakeRoleNode(null);
    const { FakeMutationObserver, instances } = createFakeMutationObserverCtor();

    watchDialogOwnerRole(node, role, FakeMutationObserver);

    expect(instances).toHaveLength(1);
    expect(instances[0].observeArgs).toEqual([
      node,
      { attributeFilter: ['role'], attributes: true },
    ]);
  });

  it('re-stamps the role whenever react-native-web overwrites it (its own activate/deactivate re-render)', () => {
    const node = createFakeRoleNode(null);
    const { FakeMutationObserver, instances } = createFakeMutationObserverCtor();

    watchDialogOwnerRole(node, role, FakeMutationObserver);
    expect(node.getAttribute('role')).toBe(role);

    // react-native-web's forced value once "active" is the literal 'dialog';
    // once it deactivates (another Modal stacked on top) it writes null. Both
    // land as attribute mutations the observer callback reacts to.
    node.setAttribute('role', 'dialog');
    instances[0].callback();
    expect(node.getAttribute('role')).toBe(role);

    (node as { setAttribute: (name: string, value: string | null) => void }).setAttribute(
      'role',
      null,
    );
    instances[0].callback();
    expect(node.getAttribute('role')).toBe(role);
  });

  it('does not call setAttribute again once the role already matches (no redundant writes)', () => {
    const node = createFakeRoleNode(role);
    const setAttributeSpy = jest.spyOn(node, 'setAttribute');
    const { FakeMutationObserver, instances } = createFakeMutationObserverCtor();

    watchDialogOwnerRole(node, role, FakeMutationObserver);
    instances[0].callback();

    expect(setAttributeSpy).not.toHaveBeenCalled();
  });

  it('stops enforcing once the returned cleanup disconnects the observer', () => {
    const node = createFakeRoleNode(null);
    const { FakeMutationObserver, instances } = createFakeMutationObserverCtor();

    const stop = watchDialogOwnerRole(node, role, FakeMutationObserver);
    stop();

    expect(instances[0].disconnect).toHaveBeenCalledTimes(1);
  });
});
