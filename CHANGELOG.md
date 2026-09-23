# Changelog

Versionado semántico (`MAJOR.MINOR.PATCH`). La versión vigente vive en `package.json`
y el home la muestra desde ahí. Reglas en CLAUDE.md → "Versionado".

Las versiones anteriores a 1.11.0 se reconstruyeron a partir del historial de git
(los commits viejos no seguían convenciones), así que sus fechas son aproximadas.

## 1.12.0 — 2026-09-23
- Nueva sección **Todo** (`/myTodoist`): gestor de tareas personal con proyectos, secciones,
  etiquetas, subtareas (un nivel), prioridades, fechas/horas y recurrencia
- Alta rápida con parser en español (`pagar luz mañana 18:00 p1 #Casa @urgente cada mes`),
  con previsualización de los tokens reconocidos a medida que se escribe
- Vistas Hoy (vencidas + hoy), Próximos (7 días), Completadas (paginado) y Dashboard
  (racha actual/mejor, vencidas, gráfico de los últimos 28 días, desglose por proyecto
  y prioridad)
- Arrastrar y soltar para reordenar (SortableJS), con orden fraccionario para no
  renumerar toda la lista en cada movimiento
- Deshacer (5 s) al completar o borrar una tarea; atajos de teclado (`q`, `/`, `g i/t/u`,
  `e`, `1`-`4`, `Esc`, `?`)
- Reutiliza el PIN y la cookie de sesión de Streaming: desbloquear una sección desbloquea
  la otra. `src/middleware.ts` protege `/api/todo/*`
- Se entra desde la tarjeta del home (igual que Streaming, no está en el menú flotante), pero
  la página sí muestra el menú flotante para moverse al resto del sitio

## 1.11.2 — 2026-09-23
- AniList se consulta desde el navegador (el `User-Agent` de 1.11.1 no arregló el 403: AniList bloquea las IPs de Cloudflare Workers, confirmado en su foro); el servidor ya no llama a AniList, solo valida y guarda lo que el navegador trae
- El detalle de un manga desactualizado se refresca solo, del lado del cliente, y recarga la página cuando termina

## 1.11.1 — 2026-09-23
- Las peticiones a AniList envían un `User-Agent` propio (intento de fix del 403 en producción)
- Relaciones, Recomendaciones y Staff del manga usan el mismo scroll fino que el Reparto de películas y series; el estilo vive una sola vez en `global.css`

## 1.11.0 — 2026-09-23
- Scores de TMDB e IMDb editables a mano en películas y series; un valor manual no lo pisa el refresco automático ni los backfills
- Espaciado unificado en todo el sitio: gutter, margen superior y margen inferior que libera el menú flotante (con safe-area de iOS)
- Modales y toasts siempre por encima del menú
- Versión visible en el home y este CHANGELOG

## 1.10.0 — 2026-09-23
- Scores TMDB, IMDb (vía OMDb) y personal en películas y series, en escala 0-100; la card muestra el promedio
- Botón Editar solo desde la ficha, homologado en juegos, series, películas y manga

## 1.9.0 — 2026-09-23
- Sección Manga / Manhwa / Manhua con metadata de AniList

## 1.8.2 — 2026-09-13
- Títulos de página sin el prefijo del sitio

## 1.8.1 — 2026-09-13
- Ajuste de padding del área principal

## 1.8.0 — 2026-09-12
- Estados `Terminado` (campaña) y `Completado` (100% de logros) separados

## 1.7.0 — 2026-09-12
- Score personal en juegos, con bandas de color

## 1.6.0 — 2026-09-11
- Tabla `movies_watched` (rewatches en varios años) y alta manual de películas

## 1.5.0 — 2026-09-11
- OpenCritic reemplaza al rating de RAWG

## 1.4.0 — 2026-09-11
- Filtros y agrupación en la biblioteca de juegos; backfill de metadata IGDB

## 1.3.0 — 2026-09-06
- Biblioteca de juegos multi-tienda con importación

## 1.2.0 — 2026-08-30
- Página de Streaming con PIN y sprite de logos

## 1.1.0 — 2026-06-19
- Flag Review (`is_testing`) y botón de sync manual reutilizable

## 1.0.0 — 2026-04-06
- Sitio completo en producción: juegos jugados, biblioteca Steam, próximos lanzamientos, películas y series, con cron diario
