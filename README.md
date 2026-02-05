# X Bot Remover

X Bot Remover is a browser extension that automates removal of X (Twitter) bot followers from your own account. It uses adjustable rules to identify bots and can also be used to clean your followers or following list.

[More details here](https://vanderwalt.de/blog/x-bot-remover)

## Features

- **Adjustable rules** – Configure thresholds for followers, following count, post count, username patterns, bio text, and more.
- **Dry run** – Preview which accounts would be removed without making changes.
- **Blacklisted countries** – Optionally exclude accounts by location.
- **Chrome and Firefox** – Build for either browser from the same codebase.

## Installation

### From the store

- **Chrome:** [Chrome Web Store](https://chromewebstore.google.com/detail/x-bot-remover/aohkhfmnpbofebaljcienghochiiohno)


### Build from source

1. **Prerequisites:** Node.js 22 and [Yarn](https://yarnpkg.com/). A [.nvmrc](.nvmrc) file is included for Node version management.
2. **Install and build:**
   ```bash
   yarn install
   yarn build:chrome   # or yarn build:firefox
   ```
3. **Load the extension:**
   - **Chrome:** Open `chrome://extensions`, enable "Developer mode", click "Load unpacked", and select the `dist_chrome` folder.
   - **Firefox:** Open `about:debugging`, click "This Firefox", "Load Temporary Add-on", and select the manifest inside the `dist_firefox` folder.

## Development

- **Chrome:** `yarn dev` or `yarn dev:chrome` – runs the extension with hot reload.
- **Firefox:** `yarn dev:firefox` – runs the extension with hot reload for Firefox.

For more on contributing and conventions, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Project structure

- `src/pages/background` – Service worker (background script).
- `src/pages/content` – Content scripts that run on X (twitter.com / x.com).
- `src/pages/options` – Options page for settings and rules.
- `src/pages/popup` – Extension popup UI.
- `src/data` – Shared data (e.g. country lists).
- `src/types` – TypeScript types for the extension.

## License

This project is licensed under the MIT License – see [LICENSE](LICENSE).

## Acknowledgments

Built with [vite-web-extension](https://github.com/JohnBra/vite-web-extension) by [JohnBra](https://github.com/JohnBra) (MIT).

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
