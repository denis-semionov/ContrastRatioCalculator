'use strict';

(() => {
  const { CHECKS, parseHex, toHex, ratio, formatRatio, suggestions } = Contrast;

  const byId = (id) => document.getElementById(id);

  const fields = {
    fg: { text: byId('fg-hex'), picker: byId('fg-picker'), error: byId('fg-error') },
    bg: { text: byId('bg-hex'), picker: byId('bg-picker'), error: byId('bg-error') },
  };

  const els = {
    ratio: byId('ratio'),
    announcer: byId('announcer'),
    preview: byId('preview'),
    intro: byId('suggestions-intro'),
    list: byId('suggestions'),
    undo: byId('undo'),
    undoText: byId('undo-text'),
    undoButton: byId('undo-button'),
  };

  // Parsed [r, g, b] for each field, or null while its text isn't a valid colour.
  const state = { fg: null, bg: null };
  // Foregrounds replaced by tapping suggestions, oldest first.
  let undoStack = [];

  /** What's wrong with the text, or '' if it's valid (or just not finished yet). */
  function errorFor(text, { finished }) {
    const value = text.trim();
    const digits = value.replace(/^#/, '');
    if (/[^0-9a-f]/i.test(digits)) return 'Use only the digits 0–9 and letters A–F.';
    if (digits.length === 8 || (digits.length === 4 && finished)) {
      return 'Transparency isn’t supported. Use 3 or 6 digits.';
    }
    if (digits.length > 6) return 'Too many digits. Use 3 or 6.';
    if (!finished || parseHex(value)) return '';
    return value ? 'Use 3 or 6 digits, like #1A2B3C.' : 'Enter a hex colour, like #1A2B3C.';
  }

  function showError(name, message) {
    const { text, error } = fields[name];
    error.textContent = message;
    if (message) text.setAttribute('aria-invalid', 'true');
    else text.removeAttribute('aria-invalid');
  }

  function setColor(name, rgb) {
    const { text, picker } = fields[name];
    state[name] = rgb;
    text.value = toHex(rgb);
    picker.value = toHex(rgb).toLowerCase();
    showError(name, '');
  }

  function clearUndo() {
    undoStack = [];
  }

  function renderVerdict(cell, passed, min) {
    const verdict = document.createElement('span');
    verdict.className = passed ? 'verdict verdict-pass' : 'verdict verdict-fail';
    const mark = document.createElement('span');
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = passed ? '✓' : '✕';
    verdict.append(mark, passed ? ' Pass' : ' Fail');

    const needs = document.createElement('span');
    needs.className = 'verdict-min';
    needs.textContent = `min ${min}:1`;

    cell.replaceChildren(verdict, needs);
  }

  function renderSuggestion(item) {
    const li = document.createElement('li');

    if (!item.color) {
      li.className = 'suggestion-none';
      li.textContent = `${item.min}:1 can’t be reached on this background. The most any colour gets is ${formatRatio(item.best.ratio)}:1, with ${toHex(item.best.color)}.`;
      return li;
    }

    const hex = toHex(item.color);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion';
    button.addEventListener('click', () => applySuggestion(item.color));

    const swatch = document.createElement('span');
    swatch.className = 'suggestion-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    swatch.textContent = 'Aa';
    swatch.style.color = hex;
    swatch.style.backgroundColor = toHex(state.bg);

    const body = document.createElement('span');
    body.className = 'suggestion-body';
    const title = document.createElement('span');
    title.className = 'suggestion-title';
    const code = document.createElement('span');
    code.className = 'suggestion-hex';
    code.textContent = hex;
    const value = document.createElement('span');
    value.textContent = `${formatRatio(item.ratio)}:1`;
    title.append(code, value);
    const passes = document.createElement('span');
    passes.className = 'suggestion-passes';
    passes.textContent = item.label;
    body.append(title, passes);

    const action = document.createElement('span');
    action.className = 'suggestion-action';
    action.setAttribute('aria-hidden', 'true');
    action.textContent = 'Use';

    button.setAttribute('aria-label', `Use ${hex}, ${formatRatio(item.ratio)} to 1. ${item.label}.`);
    button.append(swatch, body, action);
    li.append(button);
    return li;
  }

  function renderSuggestions() {
    const { fg, bg } = state;
    if (!fg || !bg) {
      els.intro.textContent = 'Enter two valid hex colours to see suggestions.';
      els.list.replaceChildren();
    } else {
      const items = suggestions(fg, bg);
      els.intro.textContent = items.length
        ? `Closest in appearance to ${toHex(fg)}, for each level it misses. Tap one to use it.`
        : 'Nothing to fix. This pair passes every check.';
      els.list.replaceChildren(...items.map(renderSuggestion));
    }

    els.undo.hidden = undoStack.length === 0;
    if (undoStack.length > 0) {
      const previous = toHex(undoStack[undoStack.length - 1]);
      const count = undoStack.length > 1 ? ` ${undoStack.length} changes to undo.` : '';
      els.undoText.textContent = `Foreground changed from ${previous}.${count}`;
    }
  }

  function render() {
    const { fg, bg } = state;
    const value = fg && bg ? ratio(fg, bg) : null;

    els.ratio.textContent = value === null ? '–' : `${formatRatio(value)}:1`;

    for (const check of CHECKS) {
      const cell = byId(check.id);
      if (value === null) cell.replaceChildren('–');
      else renderVerdict(cell, value >= check.min, check.min);
    }

    if (value === null) {
      els.announcer.textContent = '';
    } else {
      const failed = CHECKS.filter((check) => value < check.min).length;
      els.announcer.textContent = `Contrast ratio ${formatRatio(value)} to 1. ${
        failed ? `${failed} of ${CHECKS.length} checks fail.` : 'All checks pass.'
      }`;
    }

    if (fg) els.preview.style.setProperty('--preview-fg', toHex(fg));
    if (bg) els.preview.style.setProperty('--preview-bg', toHex(bg));

    renderSuggestions();
  }

  function applySuggestion(color) {
    undoStack.push(state.fg);
    setColor('fg', color);
    render();
    // The tapped button no longer exists, so keep keyboard focus somewhere useful.
    els.undoButton.focus({ preventScroll: true });
  }

  for (const name of Object.keys(fields)) {
    const { text, picker } = fields[name];

    text.addEventListener('input', () => {
      if (name === 'fg') clearUndo();
      const rgb = parseHex(text.value);
      state[name] = rgb;
      if (rgb) picker.value = toHex(rgb).toLowerCase();
      showError(name, errorFor(text.value, { finished: false }));
      render();
    });

    // Partial values are normal while typing, so only flag them on leaving.
    text.addEventListener('blur', () => {
      if (state[name]) text.value = toHex(state[name]);
      else showError(name, errorFor(text.value, { finished: true }));
    });

    picker.addEventListener('input', () => {
      if (name === 'fg') clearUndo();
      setColor(name, parseHex(picker.value));
      render();
    });
  }

  byId('swap').addEventListener('click', () => {
    const { fg, bg } = state;
    if (!fg || !bg) return;
    clearUndo();
    setColor('fg', bg);
    setColor('bg', fg);
    render();
  });

  els.undoButton.addEventListener('click', () => {
    setColor('fg', undoStack.pop());
    render();
    // Stay on the button while there's more to undo, so it can be pressed again.
    // After that it's hidden, so move on, but not to a text field: on a phone that
    // would open the keyboard.
    if (undoStack.length === 0) {
      const next = els.list.querySelector('button') || byId('suggestions-heading');
      next.focus({ preventScroll: true });
    }
  });

  // Live preview: the controls don't do anything real, so a status line shows that
  // they responded.
  const previewStatus = byId('preview-status');
  const previewInput = byId('preview-input');
  const previewSelect = byId('preview-select');

  byId('preview-button').addEventListener('click', () => {
    previewStatus.textContent = 'Button pressed.';
  });

  previewSelect.addEventListener('change', () => {
    previewStatus.textContent = previewSelect.value
      ? `Selected: ${previewSelect.value}.`
      : 'Nothing selected yet.';
  });

  byId('preview-search').addEventListener('submit', (event) => {
    event.preventDefault();
    const query = previewInput.value.trim();
    previewStatus.textContent = query ? `Searched for: ${query}` : 'Type something to search.';
  });

  setColor('fg', parseHex(fields.fg.text.value));
  setColor('bg', parseHex(fields.bg.text.value));
  render();
})();
