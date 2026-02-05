# Contributing to X Bot Remover

Thanks for your interest in contributing. Here’s how to get started and how we prefer to work.

## Getting started

1. **Clone the repository** and open it locally.
2. **Install dependencies:** `yarn install`
3. **Run in development:** `yarn dev` (Chrome) or `yarn dev:firefox` (Firefox)
4. **Build:** `yarn build:chrome` or `yarn build:firefox`

Use Node 22 (see [.nvmrc](.nvmrc)) and Yarn for consistency with CI.

## Submitting changes

1. **Open an issue first** for larger changes or new features so we can align on approach.
2. **Fork (if needed)** and create a branch from `master`.
3. **Make your changes** and test them (load the built extension and verify behavior).
4. **Open a pull request** with a clear description of what you changed and how to test it.

We’ll review and may ask for small edits. Once approved, your PR will be merged.

## Project conventions

- **Keep it simple** – Prefer straightforward, readable solutions over clever ones.
- **One clear approach** – Avoid “cascading fallbacks” (trying approach A, then B, then C). Pick one well-defined strategy and implement it.
- **Modular code** – Keep logic understandable and avoid unnecessary coupling.

If you have questions, open an issue and we’ll help.
