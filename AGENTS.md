# Repository Guidelines

## Project Structure & Module Organization

This repository contains the standalone Fiestas Monte 26 experience for Montemayor de Pililla. Source data lives in `src/data/fiestas-2026/events.json` and site identity in `src/data/fiestas-2026/site.json`. Nunjucks templates are in `src/templates/`, page styles in `src/styles/`, and browser modules in `src/scripts/`. The generated site is written to `dist/` and should not be edited by hand.

## Build, Test, and Development Commands

- `npm install`: install Nunjucks, Tailwind, PostCSS, and Autoprefixer.
- `npm run build`: generate the root site, event detail pages, CSS, JS, feeds, sitemap, robots file, and GitHub Pages `CNAME`.
- `npm run dev`: build once and serve the output at `http://127.0.0.1:8005/`.
- `npm run clean`: remove generated `dist/` output.

## Coding Style & Naming Conventions

Use ES modules and two-space indentation in JavaScript, Nunjucks, and CSS. Keep event ids numeric and URL-safe slugs matching the detail path pattern `/e/<id>/<slug>/`. Prefer descriptive data fields over template-only conditionals.

## Testing Guidelines

There is no formal test suite yet. Before publishing, run `npm run build` and check the agenda, map view, filters, favorites, mobile filter drawer, theme toggle, and at least one event detail with coordinates.

## Commit & Pull Request Guidelines

Use short imperative commit messages, for example `Extract fiestas standalone build`. Pull requests should describe the user-facing change, include verification steps, and attach screenshots for layout or responsive changes.

## URL Policy

Keep agenda routes local. External links should point only to the Montemayor de Pililla web ecosystem, official notices, maps, or the project repository.
