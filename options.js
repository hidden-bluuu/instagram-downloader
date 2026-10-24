// Made-up post, so the examples follow the settings as they are edited.
const SAMPLE = {
  username: 'natgeo',
  takenAt: Date.now() / 1000,
  caption: 'Sunrise over the Dolomites 🌄 #travel\nSecond line',
};

const examples = document.getElementById('examples');
const saved = document.getElementById('saved');
const historyCount = document.getElementById('history-count');
const clearHistoryButton = document.getElementById('clear-history');
let savedTimer;

function showExamples(settings) {
  const files = ['01.jpg', '02.mp4'];
  if (settings.saveCaption) files.push('caption.txt');
  examples.replaceChildren(
    ...files.map((file) => {
      const item = document.createElement('li');
      item.className = 'example';
      item.textContent = IGDL.postPath(settings, SAMPLE, 'DAbC123xyz', file);
      return item;
    }),
  );
}

function showSaved() {
  saved.classList.add('visible');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => saved.classList.remove('visible'), 1500);
}

bindSettings({ onChange: showExamples, onSaved: showSaved });

// Tags drop into the post name at the cursor.
const template = document.querySelector('[data-setting="nameTemplate"]');
for (const chip of document.querySelectorAll('[data-token]')) {
  chip.addEventListener('click', () => {
    template.focus();
    template.setRangeText(chip.dataset.token, template.selectionStart, template.selectionEnd, 'end');
    template.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function showHistoryCount() {
  const count = Object.keys(await IGDL.getHistory()).length;
  historyCount.textContent = count === 1 ? '1 post remembered.' : `${count} posts remembered.`;
  clearHistoryButton.disabled = count === 0;
}

clearHistoryButton.addEventListener('click', () => IGDL.clearHistory());
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') showHistoryCount();
});
showHistoryCount();

chrome.commands.getAll().then((commands) => {
  const command = commands.find((c) => c.name === 'download-post');
  document.getElementById('shortcut').textContent = command?.shortcut || 'Not set';
});

// Extensions can't link to chrome:// pages, but they can open them.
document.getElementById('change-shortcut').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

document.getElementById('reset').addEventListener('click', async () => {
  if (!confirm('Reset all settings to their defaults? Your download history is kept.')) return;
  await chrome.storage.sync.clear();
  location.reload();
});
