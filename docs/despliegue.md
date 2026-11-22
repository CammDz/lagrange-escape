# Despliegue en Cloudflare Pages y Workers

La entrega prepara recursos y comandos; **no se creó una cuenta ni se desplegó sobre recursos reales**. Necesitas una cuenta Cloudflare con permisos para Workers, Durable Objects SQLite, service bindings y Pages. Revisa los límites y costos vigentes de tu plan antes de publicar. No se requiere D1, R2, servidores Node externos ni una base de datos adicional.

## 1. Preparar y verificar

```powershell
npm ci
npm run setup
npm run typecheck
npm run lint
npm test
npm run build
```

El lockfile fija las versiones probadas. `npm run build` realiza un dry-run del Worker, no un despliegue. La migración `v1` crea `GameRoom` y `Registry` con `new_sqlite_classes`; no cambies el nombre ni elimines esta migración después de crear datos. El empaquetador Wrangler instalado ha validado esta configuración. Para una migración futura, consulta la documentación y añade un tag nuevo.

## 2. Cuenta y nombres

```powershell
node scripts/wrangler.mjs login
node scripts/wrangler.mjs whoami
```

El Worker se llama `lagrange-escape-api`. Pages se propone como `lagrange-escape`, con rama de producción `main`. Si el nombre Pages no está disponible, elige uno propio y cambia el nombre, `APP_ORIGIN` y el comando de despliegue. Configura en `apps/worker/wrangler.jsonc`, dentro de `env.production.vars`, el origen exacto definitivo, por ejemplo `https://mi-laboratorio.pages.dev`. Sin barra final. Para un dominio propio usa ese origen. La versión actual permite un único origen por instalación; no autoriza automáticamente dominios de preview.

## 3. Secretos

`npm run setup` genera `apps/worker/.dev.vars` con un hash salado `ADMIN_PASSWORD_HASH` en formato `salHex:hashHex`. La contraseña nunca va al frontend. Usa una contraseña exclusiva y fuerte de al menos 12 caracteres; para sustituir una configuración local existente utiliza `npm run setup -- --replace`.

En producción configura el hash, no la contraseña en claro:

```powershell
node scripts/wrangler.mjs secret put ADMIN_PASSWORD_HASH --config apps/worker/wrangler.jsonc --env production
```

Pega el valor `sal:hash` generado en la terminal interactiva de Wrangler. No lo incluyas en comandos, commits, capturas ni documentación pública. La variable de aplicación `APP_ORIGIN` no es un secreto; `ENVIRONMENT` debe valer `production` para exigir cookies Secure. La cuenta Cloudflare puede autenticarse con login interactivo o con `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en un entorno de CI protegido.

## 4. Publicar Worker

```powershell
npm run deploy:worker
```

Comprueba que se hayan creado ambos bindings Durable Object y la migración SQLite. El Worker es independiente de Pages. Las clases no se despliegan dentro de Pages Functions. Las peticiones directas al Worker mantienen los controles de sesión y origen.

## 5. Crear Pages y publicar

Desde la raíz, crea el proyecto con producción en `main`:

```powershell
node scripts/wrangler.mjs pages project create lagrange-escape --production-branch main
npm run deploy:web
```

El ejecutor cambia el directorio de los comandos `pages` a `apps/web`, para que Wrangler detecte su `wrangler.jsonc`, el directorio `functions` y el binding `BACKEND` hacia `lagrange-escape-api`. Se publica `apps/web/dist`. El proxy de `/api/*` envía la petición original al Worker mediante el binding, incluidas cookies, Origin y el upgrade de WebSocket. No necesitas variables `VITE_API_URL` ni conexiones cross-origin.

Si gestionas el proyecto desde el dashboard, verifica el binding de servicio **BACKEND → lagrange-escape-api** en producción y vuelve a desplegar Pages. Para Git integration configura directorio raíz `apps/web` y un comando que instale desde la raíz y compile Vite; el camino recomendado y documentado aquí es el despliegue CLI del monorepositorio.

## 6. Verificación obligatoria del entorno publicado

1. Abre `https://TU-PROYECTO.pages.dev/admin`, inicia sesión y crea una sala.
2. Genera el enlace y abre dos navegadores independientes; después prueba un celular físico en otra red.
3. Verifica WSS, inicio simultáneo, pausa, reconexión, progreso compartido y cierre automático.
4. Abre la proyección sin autenticar y confirma que no recibe respuestas ni controles privados.
5. Completa las cuatro cámaras, revisa posiciones, exporta CSV y prueba la imagen.
6. Ejecuta una nueva carga con `TEST_URL` apuntando al dominio publicado y `TEST_ADMIN_PASSWORD` definido en la terminal. No la ejecutes en una sala de estudiantes.

Las evidencias locales no aprueban estos pasos externos. La publicación puede requerir ajustar permisos de la cuenta o la disponibilidad del producto Pages en ella. Si el proveedor no ofrece un recurso en tu cuenta, conserva la implementación y resuelve ese requisito antes de abrir una clase real.

## Entornos y fallos

Desarrollo usa `ENVIRONMENT=development`, origen `http://localhost:5180`, cookies no Secure para HTTP local y datos de emulador. Producción usa HTTPS, cookies Secure, origen `pages.dev` definitivo y namespaces remotos. Las pruebas usan salas separadas en el emulador y nunca requieren una credencial Cloudflare.

- **403 al ingresar/iniciar:** `APP_ORIGIN` debe coincidir con el dominio que ve el usuario. Evita redirecciones entre `www`, dominio propio y `pages.dev` durante una partida.
- **404/500 de API en Pages:** despliega primero Worker; verifica `functions/api/[[path]].ts` y el binding `BACKEND` del proyecto.
- **WebSocket no abre:** confirma HTTPS/WSS, Origin, cookies por sala, binding y que un proxy externo permita upgrade.
- **No aparece historial local en producción:** son almacenes distintos; no se copian apodos ni sesiones automáticamente.
- **No hay permiso de Durable Objects:** revisa permisos/plan; no sustituyas el multijugador por localStorage.
- **Cambiaste la contraseña:** los accesos nuevos usan el hash actualizado. Para revocar todas las sesiones existentes hace falta una operación de mantenimiento sobre Registry; cerrar sesión revoca la sesión actual.

Fuentes oficiales: [configuración Pages](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [bindings de Pages](https://developers.cloudflare.com/pages/functions/bindings/), [rutas Functions](https://developers.cloudflare.com/pages/functions/routing/), [comandos Pages](https://developers.cloudflare.com/workers/wrangler/commands/pages/), [WebSockets hibernables](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
