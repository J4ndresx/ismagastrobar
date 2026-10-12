# ISMA GASTRO-BAR — guía de cambios

Los archivos de este zip se copian ENCIMA de tu proyecto (misma estructura de carpetas).

## Esquema Firestore (`restaurantes/isma/…`)
| Colección | Contenido |
|---|---|
| `categorias` | Menú del Día, Tradicional, Proteínas, A la Carta, Picadas, Bebidas, Adicionales |
| `menu_items` | = tu `productos`: nombre, precio, categoria_id, activo, **agotado**, grupos_opciones (obligatorios), modificadores |
| `grupos_opciones` | Término, Acompañamiento, Porción (Para 2 personas) |
| `menu_del_dia/actual` | `{ sopaDelDia:[{id,nombre}], proteinaDelDia:[…], bebidaDelDia:[…], fecha:'YYYY-MM-DD', disponible:bool, actualizado_en, actualizado_por }` — solo admin escribe, lectura pública |
| `pedidos` | = tu `pedidos` (mesa, items, total, estado, creado_en, creado_por/mesero) |
| `config/tienda` | abrir/cerrar la app. Datos del negocio: `shared/comandas.js` y `cliente/src/config/negocio.js` |

Roles = custom claims `{rid:'isma', rol:'admin'|'cajero'|'vendedora'|'impresora'}` (scripts/crear-usuario.mjs). El cliente no tiene cuenta: solo lee menú y crea pedidos "por aprobar".

## Pasos
1. Proyecto Firebase NUEVO para ISMA (plan Blaze). `firebase use <id>`; copia `.env.example` → `.env.local` en `cliente/` y `web/`.
2. Copia los archivos del zip. Pon los precios reales en `shared/menu.seed.js` → `PRECIOS`.
3. `node scripts/sync-shared.mjs` y `cd functions && npm install && npm test`.
4. `firebase deploy --only firestore:rules,functions`
5. `cd scripts && npm install && GOOGLE_APPLICATION_CREDENTIALS=<clave-nueva>.json node cargar-menu.mjs`
6. Usuario dueño: `node crear-usuario.mjs dueno@isma.app <clave> admin --nombre=Isma`
7. `cd cliente && npm install && npm run build` y `cd ../web && npm install && npm run build`; `firebase deploy --only hosting`.

Dependencias nuevas: ninguna (ya usa `firebase`; no hace falta react-firebase-hooks).
