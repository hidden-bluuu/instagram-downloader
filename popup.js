const downloadButton = document.getElementById('download');
const hint = document.getElementById('hint');
const preview = document.getElementById('preview');

// Made-up post, so the example under the folder choices follows the user's settings.
const SAMPLE = { username: 'user', takenAt: Date.now() / 1000, caption: 'Sunset at the lake' };

bindSettings({
  onChange: (settings) => {
    preview.textContent = IGDL.postPath(settings, SAMPLE, 'ABC123', '01.jpg');
  },
});

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

// The content script only runs on instagram.com (and only in tabs loaded after
// the extension), so no answer means there is nothing to download here.
activeTabId()
  .then((id) => chrome.tabs.sendMessage(id, { type: 'status' }))
  .catch(() => null)
  .then((status) => {
    const onPost = Boolean(status?.onPost);
    downloadButton.disabled = !onPost;
    if (status?.downloadedAt) {
      downloadButton.textContent = '⬇ Download again';
      hint.textContent = `You downloaded this post on ${IGDL.formatDate(status.downloadedAt / 1000)}.`;
      hint.hidden = false;
    } else if (!onPost) {
      hint.textContent = 'Open a post on instagram.com first (refresh the page if one is already open).';
      hint.hidden = false;
    }
  });

// Progress shows on the page's own button and the toolbar badge, so the popup can get out of the way.
downloadButton.addEventListener('click', async () => {
  await chrome.tabs.sendMessage(await activeTabId(), { type: 'trigger' }).catch(() => {});
  window.close();
});

document.getElementById('settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

document.getElementById('open-folder').addEventListener('click', () => {
  chrome.downloads.showDefaultFolder();
  window.close();
});
