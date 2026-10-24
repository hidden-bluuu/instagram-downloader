# Instagram Post Downloader

This is a very simple open source project that allows you to download any image or video from Instagram, in the highest resolution available.
This project is fully open source so you can review the code or make changes.
This project is not made or maintained by Instagram or their respective company.

## Features

- **Download a whole post** – every photo and video in a post, carousels and reels included, at the largest size Instagram offers
- **Download a single image** – right-click any image on Instagram
- **Your choice of folders** – each post in its own folder, all posts in one folder, or no folder at all
- **Your own file names** – build names from the username, date, caption and post code
- **Photos only, videos only, or both**
- **Save the caption** as a `caption.txt` next to the files
- **Remembers what you downloaded** – the button changes to "Download again" on posts you already saved
- **Three ways to start a download** – the button on the post, the toolbar icon, or a keyboard shortcut (`Alt+Shift+D`, `⌥⇧D` on Mac)
- **No accounts, no tracking, no servers** – see [Privacy](#privacy)

## Install

The extension is not on the Chrome Web Store, so you load it yourself. It takes a minute.

1. Download this repository (**Code → Download ZIP** and unzip it) or clone it:
   ```bash
   git clone https://github.com/hidden-bluuu/instagram-downloader.git
   ```
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the project folder.
4. Open [instagram.com](https://www.instagram.com/) and log in.

It is built for Chrome. Other Chromium browsers (Edge, Brave…) should work as well, but they have not been tested. Firefox is not supported.

After updating or reloading the extension, refresh any open Instagram tabs. Tabs that were already open keep talking to the old version.

## How to use

Open a post, a reel or a video on Instagram, then do any of these:

- Click the blue **⬇ Download all** button at the top of the page
- Click the extension icon in the toolbar and press **Download this post**
- Press `Alt+Shift+D`

To save just one image, right-click it and choose **Download this image (highest resolution)**. This also works on grid thumbnails and in the feed.

Files go to your normal Downloads folder. Existing files are never overwritten, a number is added instead.

## Settings

Click the extension icon for the quick options, or **All settings** for everything. Changes are saved as you make them.

| Setting | Default | What it does |
|---|---|---|
| Save files | Each post in its own folder | Own folder per post, one shared folder, or straight into Downloads |
| Main folder | `Instagram` | Folder inside Downloads. Can be nested, e.g. `Social/Instagram` |
| Post name | `{user} - {date} - {caption}` | Names the post's folder (or prefixes each file). Tags: `{user}` `{date}` `{caption}` `{code}`. Add `/` to make subfolders |
| Caption length | `40` | How many characters of the caption's first line go into `{caption}` |
| Download | Photos and videos | Photos only, videos only, or both |
| Save caption | Off | Also saves `caption.txt` with the caption, author, date and a link to the post |
| Remember downloaded posts | On | Shows "Download again" on posts you already saved |
| Show the button on posts | On | The on-page button. When hidden, progress shows as a badge on the toolbar icon |
| Button position | Top | Top or bottom of the page |

The keyboard shortcut can be changed at `chrome://extensions/shortcuts`.

### Where the files end up

With the default name, for a post by `natgeo` with the caption "Sunrise over the Dolomites":

| Save files | Result |
|---|---|
| Each post in its own folder | `Instagram/natgeo - 2026-10-24 - Sunrise over the Dolomites/01.jpg` |
| All posts in one folder | `Instagram/natgeo - 2026-10-24 - Sunrise over the Dolomites - 01.jpg` |
| No folder | `natgeo - 2026-10-24 - Sunrise over the Dolomites - 01.jpg` |

Files are numbered by slide. If you download photos only from a post that mixes photos and videos, the numbers keep their place (`01`, `03`…).

A post name of `{user}/{date} {caption}` gives you one folder per account instead:
`Instagram/natgeo/2026-10-24 Sunrise over the Dolomites/01.jpg`

## Privacy

- The extension only runs on `https://www.instagram.com/`.
- It asks Instagram for the post using your existing login, the same way the website does, and downloads the files from Instagram's own servers.
- It sends nothing anywhere else. There is no analytics, no tracking and no server of its own.
- Settings are kept with Chrome's extension storage, so Chrome sync may carry them to your other devices. The list of downloaded posts stays on this computer only, and you can clear it in the settings.

Permissions it asks for: `downloads` (to save files), `contextMenus` (the right-click item) and `storage` (your settings).

## Limitations

- Instagram has no public download API, so this relies on the same internal requests the website uses. Instagram can change them at any time and break the extension. If that happens, please open an issue.
- You need to be logged in, and you can only download what your account can see.
- Stories and highlights are not supported as posts. Right-clicking an image on one saves the largest version the page itself offers, which can be lower resolution.

Please respect the people who made the content. Downloading is meant for your own use and for posts you have permission to save.

## Development

There is no build step, no dependencies and no framework. It is plain JavaScript (Manifest V3), so you can edit a file, click the reload icon on `chrome://extensions` and refresh Instagram.

| File | Purpose |
|---|---|
| `manifest.json` | Extension definition, permissions, keyboard shortcut |
| `content.js` | Runs on Instagram: finds the post, fetches its media, shows the button |
| `background.js` | Does the downloads, the right-click menu, the shortcut and the toolbar badge |
| `shared.js` | Default settings and the code that builds folder and file names |
| `popup.*` | The menu that opens from the toolbar icon |
| `options.*` | The settings page |
| `bind.js`, `common.css` | Shared pieces of the popup and the settings page |

Pull requests and bug reports are welcome. The extension is English only.

## License

[MIT](LICENSE). You can use, copy, change and share it freely, as long as the license notice stays with it.

Instagram is a trademark of Meta Platforms, Inc. This project is independent and is not affiliated with, endorsed by or sponsored by Instagram or Meta.
