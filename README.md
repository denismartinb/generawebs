# WebStudio

Estructura actual:

- `index.html`: landing publica de marketing.
- `auth.html`: registro, login y recuperacion de contrasena.
- `app.html`: generador de webs privado, protegido por login.
- `profile.html`: pagina privada para editar los datos del usuario autenticado.
- `js/supabase-config.js`: configuracion del proyecto Supabase.
- `supabase/schema.sql`: tablas y politicas base para usuarios y proyectos.

## Stack recomendado

- Frontend estatico: HTML, CSS y JS.
- Auth y base de datos: Supabase (`Auth` + `PostgreSQL` + `RLS`).
- Despliegue frontend: GitHub Pages.

## Configuracion minima

1. Crea un proyecto en Supabase.
2. Ejecuta `supabase/schema.sql` en el SQL Editor.
3. Abre `js/supabase-config.js`.
4. Sustituye:
   - `YOUR_SUPABASE_URL`
   - `YOUR_SUPABASE_ANON_KEY`
5. En Supabase Auth, configura:
   - `Site URL`: la URL publica de tu proyecto
   - `Redirect URLs`: `https://tu-dominio/auth.html`

## Flujo actual

- Landing publica en `index.html`.
- El usuario entra por `auth.html`.
- Si hay sesion valida, `app.html` carga el generador.
- Desde `app.html`, el chip de `Workspace` lleva a `profile.html`.
- Si no hay sesion, `app.html` redirige a `auth.html`.

## Siguiente paso natural

Guardar el estado del generador por usuario en `public.site_projects` para que cada cliente pueda:

- crear varias webs
- recuperar borradores
- editar proyectos ya publicados
