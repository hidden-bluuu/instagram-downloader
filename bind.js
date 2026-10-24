// Wires every [data-setting] control on a page to extension storage: fills it
// from the saved value, then saves changes as they happen. Text and number
// fields are debounced to stay under the sync write quota.
async function bindSettings({ onChange, onSaved } = {}) {
  const controls = [...document.querySelectorAll('[data-setting]')];
  const settings = await IGDL.load();
  const pending = {};
  let timer;

  for (const el of controls) {
    const value = settings[el.dataset.setting];
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else if (el.type === 'radio') el.checked = el.value === value;
    else el.value = value;
  }
  onChange?.(settings);

  async function flush() {
    clearTimeout(timer);
    const batch = { ...pending };
    for (const key of Object.keys(batch)) delete pending[key];
    await chrome.storage.sync.set(batch);
    onSaved?.();
  }

  for (const el of controls) {
    const typed = el.type === 'text' || el.type === 'number';
    el.addEventListener(typed ? 'input' : 'change', () => {
      if (el.type === 'radio' && !el.checked) return;
      if (el.type === 'number' && el.value === '') return; // mid-edit; keep the old value
      const key = el.dataset.setting;
      if (el.type === 'checkbox') settings[key] = el.checked;
      else if (el.type === 'number') settings[key] = Number(el.value);
      else settings[key] = el.value;
      pending[key] = settings[key];
      onChange?.(IGDL.normalize(settings));
      clearTimeout(timer);
      if (typed) timer = setTimeout(flush, 400);
      else flush();
    });
  }
}
