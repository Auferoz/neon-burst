# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Neon Burst is a personal gaming tracker/catalog built with Astro 6, Vue 3, and Tailwind CSS 4. It tracks played games, Steam library, and upcoming games. The site is in Spanish. Visual style is neon/cyberpunk dark mode with a terminal aesthetic.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build (outputs to `dist/`)
- `npm run preview` — Preview production build locally
- `npm run generate-types` — Generate Cloudflare Worker types via Wrangler

No test framework is configured.

## Architecture

- **Astro 6** with SSR via `@astrojs/cloudflare` adapter, deployed to Cloudflare Workers/Pages
- **Vue 3** integration for interactive components (`@astrojs/vue`)
- **Tailwind CSS 4** via Vite plugin (imported in `src/styles/global.css`)
- **Cloudflare D1** as database for game data
- **TypeScript** with strict config extending `astro/tsconfigs/strict`

### Component Structure

- `src/components/Astro/` — Astro components (PageHeader, EmptyState, FloatingNav, NavCard)
- `src/components/Vue/` — Vue components
- `src/components/Icons/` — SVG icon components (Lucide-style, stroke 1.5px)
- `src/layouts/Layout.astro` — Base HTML layout with global styles, neon glow utilities, and floating nav
- `src/pages/` — File-based routing
- `src/data/gamesDB.js` — Local game database (`ListGames` array)
- `src/styles/global.css` — Tailwind theme with neon color tokens

### Design System

- **Primary**: neon-blue `#1e90ff` — used for nav active states, headings, terminal accents
- **Secondary**: neon-cyan `#00e5ff`, neon-pink `#ff2d95`
- **Surfaces**: surface-0 `#06060a` through surface-4 `#222236`
- **Font**: Fira Code (monospace) — terminal aesthetic
- Neon glow classes: `neon-glow-blue`, `neon-glow-cyan`, `neon-glow-pink` (defined in Layout.astro)
- Floating bottom navigation bar with icon-only on mobile, icons+text on desktop

### Deployment

GitHub push triggers automatic deploy to Cloudflare Pages/Workers. `wrangler.jsonc` points to `@astrojs/cloudflare/entrypoints/server` as main entry and `./dist` for static assets.

## Conventions

- Language: Spanish (UI text, comments, field names like `estado`, `horasTotal`, `logros_obt`)
- Node.js >=22.12.0 required
- ESM (`"type": "module"` in package.json)
- Components always go in their respective subfolder (`Astro/`, `Vue/`, `Icons/`), never directly in `src/components/`
