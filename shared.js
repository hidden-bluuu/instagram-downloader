// Loaded by the content script and by the popup and options pages, so all of
// them read settings and build file paths the same way.
const IGDL = (() => {
  const DEFAULTS = {
    folderMode: 'post', // 'post' | 'shared' | 'none'
    rootFolder: 'Instagram',
    nameTemplate: '{user} - {date} - {caption}',
    captionLength: 40,
    mediaTypes: 'all', // 'all' | 'photos' | 'videos'
    saveCaption: false,
    rememberHistory: true,
    showButton: true,
    buttonPosition: 'top', // 'top' | 'bottom'
  };
  const MAX_HISTORY = 2000;

  function normalize(raw) {
    const s = { ...DEFAULTS, ...raw };
    const oneOf = (key, allowed) => {
      if (!allowed.includes(s[key])) s[key] = DEFAULTS[key];
    };
    oneOf('folderMode', ['post', 'shared', 'none']);
    oneOf('mediaTypes', ['all', 'photos', 'videos']);
    oneOf('buttonPosition', ['top', 'bottom']);
    const length = Math.round(Number(s.captionLength));
    s.captionLength = Number.isFinite(length) ? Math.min(100, Math.max(0, length)) : DEFAULTS.captionLength;
    if (!String(s.nameTemplate).trim()) s.nameTemplate = DEFAULTS.nameTemplate;
    return s;
  }

  async function load() {
    return normalize(await chrome.storage.sync.get(DEFAULTS));
  }

  // Posts already downloaded, as { shortcode: time }. Kept out of sync storage
  // because it grows and does not need to follow the user between machines.
  async function getHistory() {
    return (await chrome.storage.local.get({ history: {} })).history;
  }

  async function markDownloaded(shortcode) {
    const history = await getHistory();
    history[shortcode] = Date.now();
    const codes = Object.keys(history);
    const surplus = codes.length - MAX_HISTORY;
    if (surplus > 0) {
      codes.sort((a, b) => history[a] - history[b]);
      for (const code of codes.slice(0, surplus)) delete history[code];
    }
    await chrome.storage.local.set({ history });
  }

  function clearHistory() {
    return chrome.storage.local.remove('history');
  }

  // Keeps letters, digits and a few safe separators; path segments must not
  // start or end with a dot or space.
  function clean(text) {
    return (text ?? '')
      .replace(/[^\p{L}\p{N} ._-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[ .]+|[ .]+$/g, '');
  }

  // "a/b" -> two cleaned segments, so a typed path can never escape Downloads.
  function cleanPath(text) {
    return (text ?? '').split('/').map(clean).filter(Boolean).join('/');
  }

  function formatDate(unixSeconds) {
    if (!unixSeconds) return null;
    const d = new Date(unixSeconds * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Fills {user}, {date}, {caption} and {code} in the template. Posts have no
  // title, so the first line of the caption stands in for one. Tokens that come
  // out empty take their separator with them ("user - date -" -> "user - date").
  function postName(settings, post, shortcode) {
    const tokens = {
      user: clean(post.username) || 'instagram',
      date: formatDate(post.takenAt) ?? '',
      caption: clean((post.caption ?? '').split('\n')[0])
        .slice(0, settings.captionLength)
        .replace(/[ .]+$/, ''),
      code: shortcode,
    };
    const name = settings.nameTemplate
      .split('/')
      .map((segment) =>
        clean(segment.replace(/\{(\w+)\}/g, (_, key) => tokens[key] ?? ''))
          .replace(/(\s-){2,}/g, ' -')
          .replace(/^(?:-\s*)+|(?:\s*-)+$/g, ''),
      )
      .filter(Boolean)
      .join('/');
    return name || shortcode;
  }

  function rootPath(settings, file) {
    if (settings.folderMode === 'none') return file;
    return `${cleanPath(settings.rootFolder) || DEFAULTS.rootFolder}/${file}`;
  }

  // post   -> Instagram/<name>/01.jpg
  // shared -> Instagram/<name> - 01.jpg
  // none   -> <name> - 01.jpg
  function postPath(settings, post, shortcode, fileName) {
    const name = postName(settings, post, shortcode);
    return settings.folderMode === 'post'
      ? rootPath(settings, `${name}/${fileName}`)
      : rootPath(settings, `${name} - ${fileName}`);
  }

  return {
    DEFAULTS,
    normalize,
    load,
    getHistory,
    markDownloaded,
    clearHistory,
    clean,
    formatDate,
    postName,
    rootPath,
    postPath,
  };
})();
