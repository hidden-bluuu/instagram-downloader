(() => {
  const APP_ID = '936619743392459'; // Instagram's public web app id
  const GRAPHQL_DOC_ID = '8845758582119845';
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  // /p/CODE/, /reel/CODE/, /reels/CODE/, /tv/CODE/, optionally prefixed by /username/
  const POST_RE = /^\/(?:[\w.]+\/)?(?:p|reels?|tv)\/(?!audio\/)([\w-]{5,})/;
  const LABEL = '⬇ Download all';
  const LABEL_AGAIN = '⬇ Download again';

  let busy = false;
  let idle = true; // the button shows its resting label, not a status
  let resetTimer = null;
  let clickedImage = null;
  let settings = { ...IGDL.DEFAULTS };
  let history = {};

  const button = document.createElement('button');
  button.id = 'igdl-button';
  button.type = 'button';
  button.hidden = true;
  button.addEventListener('click', () => withStatus(downloadPost));
  document.body.appendChild(button);
  render();

  // Storage calls fail once the extension has been reloaded under an open tab.
  IGDL.load().then(applySettings).catch(() => {});
  IGDL.getHistory().then(applyHistory).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') IGDL.load().then(applySettings).catch(() => {});
    if (area === 'local' && changes.history) applyHistory(changes.history.newValue ?? {});
  });

  // Instagram is a SPA; polling the URL is simpler and sturdier than hooking history.
  setInterval(render, 500);

  // Instagram covers photos with an overlay, so the browser never reports the
  // <img> itself as the right-click target; look it up under the cursor instead.
  document.addEventListener(
    'contextmenu',
    (e) => {
      clickedImage =
        document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.tagName === 'IMG') ?? null;
    },
    true,
  );

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'trigger') withStatus(downloadPost);
    if (msg?.type === 'download-image') withStatus(downloadImage);
    // The popup asks so it can grey out its download button off a post.
    if (msg?.type === 'status') {
      const code = currentShortcode();
      sendResponse({ onPost: code != null, downloadedAt: (code && history[code]) || null });
    }
  });

  function applySettings(next) {
    settings = next;
    render();
  }

  function applyHistory(next) {
    history = next;
    render();
  }

  async function loadSettings() {
    try {
      settings = await IGDL.load();
    } catch {
      // Same cause as in download(): the extension was reloaded under this tab.
      throw new Error('Refresh the page and try again');
    }
    return settings;
  }

  function currentShortcode() {
    return location.pathname.match(POST_RE)?.[1] ?? null;
  }

  // The button doubles as the status line, so it stays visible while it has something to say.
  function render() {
    const code = currentShortcode();
    if (idle) button.textContent = code && history[code] ? LABEL_AGAIN : LABEL;
    button.hidden = !settings.showButton || (idle && !code);
    button.dataset.position = settings.buttonPosition;
  }

  function setStatus(text) {
    idle = false;
    button.textContent = text;
    render();
  }

  // With the on-page button hidden, the toolbar icon's badge carries the progress.
  function setBadge(text) {
    try {
      chrome.runtime.sendMessage({ type: 'badge', text })?.catch(() => {});
    } catch {
      // Extension reloaded under this tab; there is nobody to tell.
    }
  }

  async function withStatus(task) {
    if (busy) return;
    busy = true;
    button.disabled = true;
    clearTimeout(resetTimer);
    setBadge('…');
    try {
      await task();
      setBadge('✓');
    } catch (err) {
      console.error('[IG Downloader]', err);
      setStatus(`✗ ${err.message}`);
      setBadge('!');
    } finally {
      busy = false;
      button.disabled = false;
      resetTimer = setTimeout(() => {
        idle = true;
        render();
        setBadge('');
      }, 4000);
    }
  }

  async function downloadPost() {
    const shortcode = currentShortcode();
    if (!shortcode) throw new Error('Open a post first');
    setStatus('Finding media…');
    const s = await loadSettings();
    const post = await fetchPost(shortcode);
    // Slides keep their own number, so photos only from a mixed post reads 01, 03…
    const wanted = post.media
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => s.mediaTypes === 'all' || (s.mediaTypes === 'videos') === item.video);
    if (!wanted.length) throw new Error(`This post has no ${s.mediaTypes}`);

    for (const [n, { item, index }] of wanted.entries()) {
      setStatus(`Downloading ${n + 1}/${wanted.length}…`);
      await download(item.url, IGDL.postPath(s, post, shortcode, fileName(item, index)));
    }
    if (s.saveCaption && post.caption?.trim()) {
      await download(captionUrl(post, shortcode), IGDL.postPath(s, post, shortcode, 'caption.txt'));
    }
    if (s.rememberHistory) await IGDL.markDownloaded(shortcode).catch(() => {});
    setStatus(`✓ Downloaded ${wanted.length}`);
  }

  async function downloadImage() {
    const img = clickedImage;
    if (!img) throw new Error('No image under the cursor');
    setStatus('Finding image…');
    const s = await loadSettings();

    // Every rendition of a photo shares one file name, which is how the
    // on-screen <img> is matched to its slide in the post data.
    const name = basename(img.currentSrc || img.src);
    const shortcode = shortcodeFor(img);
    const post = shortcode ? await fetchPost(shortcode).catch(() => null) : null;
    const index = post ? post.media.findIndex((m) => !m.video && basename(m.url) === name) : -1;
    if (index >= 0) {
      const item = post.media[index];
      await download(item.url, IGDL.postPath(s, post, shortcode, fileName(item, index)));
      setStatus('✓ Image downloaded');
      return;
    }

    // Not part of a readable post (avatar, story, logged out…): take the
    // largest rendition the page itself offers.
    const url = largestFromSrcset(img);
    if (!/^https?:/.test(url)) throw new Error("This image can't be downloaded");
    await download(url, IGDL.rootPath(s, IGDL.clean(basename(url)) || 'image.jpg'));
    setStatus('✓ Downloaded (page resolution)');
  }

  // Grid thumbnail -> its own link; open post -> the URL; feed -> the post's permalink.
  function shortcodeFor(img) {
    const fromLink = (a) => (a ? new URL(a.href).pathname.match(POST_RE)?.[1] : null);
    const own = fromLink(img.closest('a[href]'));
    if (own) return own;
    const open = currentShortcode();
    if (open) return open;
    for (const a of img.closest('article')?.querySelectorAll('a[href]') ?? []) {
      const code = fromLink(a);
      if (code) return code;
    }
    return null;
  }

  function largestFromSrcset(img) {
    const candidates = (img.srcset || '')
      .split(',')
      .map((entry) => entry.trim().split(/\s+/))
      .filter(([url]) => url)
      .map(([url, width]) => ({ url, width: parseInt(width, 10) || 0, height: 1 }));
    return largest(candidates)?.url ?? (img.currentSrc || img.src);
  }

  function basename(url) {
    try {
      return new URL(url, location.href).pathname.split('/').pop();
    } catch {
      return '';
    }
  }

  // The v1 API returns the largest renditions (up to the original upload size),
  // GraphQL tops out at 1080px, so it is only the fallback.
  async function fetchPost(shortcode) {
    const errors = [];
    for (const source of [fetchViaApi, fetchViaGraphql]) {
      try {
        const post = await source(shortcode);
        if (post.media.length) return post;
        errors.push(`${source.name}: no media`);
      } catch (err) {
        errors.push(`${source.name}: ${err.message}`);
      }
    }
    console.warn('[IG Downloader]', errors);
    throw new Error("Couldn't read the post (are you logged in?)");
  }

  async function fetchViaApi(shortcode) {
    const res = await fetch(`${location.origin}/api/v1/media/${shortcodeToId(shortcode)}/info/`, {
      headers: requestHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const item = (await res.json()).items?.[0];
    if (!item) throw new Error('empty response');
    const slides = item.carousel_media ?? [item];
    return {
      username: item.user?.username,
      takenAt: item.taken_at,
      caption: item.caption?.text,
      media: slides
        .map((slide) =>
          slide.video_versions?.length
            ? { url: largest(slide.video_versions)?.url, video: true }
            : { url: largest(slide.image_versions2?.candidates)?.url, video: false },
        )
        .filter((m) => m.url),
    };
  }

  async function fetchViaGraphql(shortcode) {
    const res = await fetch(`${location.origin}/graphql/query`, {
      method: 'POST',
      headers: { ...requestHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        doc_id: GRAPHQL_DOC_ID,
        variables: JSON.stringify({ shortcode }),
      }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const post = (await res.json()).data?.xdt_shortcode_media;
    if (!post) throw new Error('empty response');
    const nodes = post.edge_sidecar_to_children?.edges.map((e) => e.node) ?? [post];
    return {
      username: post.owner?.username,
      takenAt: post.taken_at_timestamp,
      caption: post.edge_media_to_caption?.edges[0]?.node.text,
      media: nodes
        .map((node) => {
          if (node.is_video) return { url: node.video_url, video: true };
          const resources = (node.display_resources ?? []).map((r) => ({
            url: r.src,
            width: r.config_width,
            height: r.config_height,
          }));
          return { url: largest(resources)?.url ?? node.display_url, video: false };
        })
        .filter((m) => m.url),
    };
  }

  function requestHeaders() {
    const csrf = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)?.[1];
    return {
      'X-IG-App-ID': APP_ID,
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrf ? { 'X-CSRFToken': csrf } : {}),
    };
  }

  function largest(versions) {
    return (versions ?? []).reduce(
      (best, v) => (!best || v.width * v.height > best.width * best.height ? v : best),
      null,
    );
  }

  function shortcodeToId(shortcode) {
    // Old private-post links carry a 28-char suffix that is not part of the id.
    const code = shortcode.length > 28 ? shortcode.slice(0, -28) : shortcode;
    let id = 0n;
    for (const ch of code) id = id * 64n + BigInt(ALPHABET.indexOf(ch));
    return id.toString();
  }

  // 01.jpg, 02.mp4… numbered by slide.
  function fileName(item, index) {
    const ext = basename(item.url).match(/\.(\w{3,4})$/)?.[1] ?? (item.video ? 'mp4' : 'jpg');
    return `${String(index + 1).padStart(2, '0')}.${ext}`;
  }

  // The caption goes into a small text file next to the media, followed by where it came from.
  function captionUrl(post, shortcode) {
    const lines = [post.caption.trim(), '', '---'];
    if (post.username) lines.push(`Author: @${post.username}`);
    if (post.takenAt) lines.push(`Posted: ${IGDL.formatDate(post.takenAt)}`);
    lines.push(`${location.origin}/p/${shortcode}/`);
    return `data:text/plain;charset=utf-8,${encodeURIComponent(lines.join('\n'))}`;
  }

  async function download(url, filename) {
    let response;
    try {
      response = await chrome.runtime.sendMessage({ type: 'download', url, filename });
    } catch {
      // Happens when the extension was reloaded while this tab stayed open.
      throw new Error('Refresh the page and try again');
    }
    if (!response?.ok) throw new Error(response?.error ?? 'Download failed');
  }
})();
