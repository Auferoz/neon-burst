# Neon Burst

Personal gaming tracker con estética neon/cyberpunk dark mode.

## Stack

- **Astro 6** — Framework web con SSR
- **Vue 3** — Componentes interactivos
- **Tailwind CSS 4** — Estilos utility-first
- **Cloudflare Workers/Pages** — Hosting y deploy automático desde GitHub
- **Cloudflare D1** — Base de datos SQL

## Desarrollo

```bash
npm install
npm run dev
```

## Scripts

| Comando | Descripción |
|---------|------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Preview del build |
| `npm run generate-types` | Generar tipos de Cloudflare Workers |

## Estructura

```
src/
├── components/
│   ├── Astro/        # Componentes Astro
│   ├── Vue/          # Componentes Vue
│   └── Icons/        # Iconos SVG
├── data/             # Base de datos local de juegos
├── layouts/          # Layout base
├── pages/            # Rutas (file-based routing)
└── styles/           # Tailwind theme y tokens de color
```

## Requisitos

- Node.js >= 22.12.0
