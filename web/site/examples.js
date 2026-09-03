(() => {
  function initSearch() {
    const input = document.querySelector('[data-example-search]');
    if (!(input instanceof HTMLInputElement)) return;
    const scope = input.closest('#all-examples') || document;
    const items = [...scope.querySelectorAll('[data-search-item]')];
    const status = scope.querySelector('[data-example-search-status]');

    const apply = () => {
      const query = input.value.trim().toLowerCase();
      let visible = 0;
      for (const item of items) {
        const haystack = (item.getAttribute('data-search-text') || item.textContent || '').toLowerCase();
        const match = !query || haystack.includes(query);
        item.hidden = !match;
        if (match) visible += 1;
      }
      if (status) status.textContent = query ? `${visible} of ${items.length} examples match “${input.value.trim()}”.` : `${items.length} examples available.`;
    };

    input.addEventListener('input', apply);
    apply();
  }

  function activateTab(tabset, nextTab) {
    const tabs = [...tabset.querySelectorAll('[role="tab"]')];
    const panels = [...tabset.querySelectorAll('[role="tabpanel"]')];
    for (const tab of tabs) {
      const selected = tab === nextTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.id !== nextTab.getAttribute('aria-controls');
    nextTab.focus();
  }

  function initTabs() {
    for (const tabset of document.querySelectorAll('[data-tabset]')) {
      const tabs = [...tabset.querySelectorAll('[role="tab"]')];
      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activateTab(tabset, tab));
        tab.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          let nextIndex = index;
          if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
          if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
          if (event.key === 'Home') nextIndex = 0;
          if (event.key === 'End') nextIndex = tabs.length - 1;
          activateTab(tabset, tabs[nextIndex]);
        });
      });
    }
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('copy failed');
  }

  function initCopyButtons() {
    for (const button of document.querySelectorAll('[data-copy-target]')) {
      const defaultLabel = button.textContent || 'Copy code';
      button.addEventListener('click', async () => {
        const id = button.getAttribute('data-copy-target');
        const source = id ? document.getElementById(id) : null;
        if (!source) return;
        try {
          await copyText(source.textContent || '');
          button.textContent = 'Copied';
        } catch {
          button.textContent = 'Copy failed';
        }
        window.setTimeout(() => {
          button.textContent = defaultLabel;
        }, 1800);
      });
    }
  }

  initSearch();
  initTabs();
  initCopyButtons();
})();
