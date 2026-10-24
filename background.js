const MENU_ID = 'igdl-image';

// Menus survive service-worker restarts but not reinstalls/updates.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Download this image (highest resolution)',
      // 'all' because Instagram's overlay hides the <img> from the 'image' context.
      contexts: ['all'],
      documentUrlPatterns: ['https://www.instagram.com/*'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || tab?.id == null) return;
  chrome.tabs.sendMessage(tab.id, { type: 'download-image' }).catch(() => {});
});

// Keyboard shortcut (rebindable at chrome://extensions/shortcuts).
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'download-post') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return;
  chrome.tabs.sendMessage(tab.id, { type: 'trigger' }).catch(() => {});
});

const BADGE_COLORS = { '✓': '#1a8f3c', '!': '#d93025' };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Content scripts report progress here so it shows even when the on-page button is hidden.
  if (msg?.type === 'badge' && sender.tab?.id != null) {
    const tabId = sender.tab.id;
    chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLORS[msg.text] ?? '#0095f6' });
    chrome.action.setBadgeText({ tabId, text: msg.text });
    return;
  }

  // Content scripts can't call chrome.downloads, so they hand each file to us.
  if (msg?.type !== 'download') return;
  chrome.downloads
    .download({
      url: msg.url,
      filename: msg.filename,
      conflictAction: 'uniquify',
      saveAs: false,
    })
    .then(
      (id) => sendResponse({ ok: true, id }),
      (err) => sendResponse({ ok: false, error: String(err?.message ?? err) }),
    );
  return true; // keep the channel open for the async response
});
