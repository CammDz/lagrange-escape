# Lagrange Escape — Desafío contrarreloj

Videojuego educativo multijugador en español de Colombia. Los estudiantes ensamblan un reactor, conectan derivadas, desbloquean una bóveda y optimizan un núcleo. Las respuestas, los puntajes y el reloj se validan en un Worker de Cloudflare con un Durable Object por sala. No hay jugadores ni resultados simulados en la aplicación.

## Inicio local

Requiere Node.js 24 LTS, npm, navegador moderno y conexión a Internet para instalar dependencias. Probado con Node 24.16.0. Desde esta carpeta:

```powershell
npm ci
npm run setup
npm run dev
```

Abre **http://localhost:5180/**. Administración: **http://localhost:5180/admin**. La contraseña la eliges al ejecutar `setup`; no hay una contraseña predeterminada. Si esta copia contiene credenciales locales de las pruebas, ejecuta `npm run setup -- --replace` y reinicia el servidor. La entrada de contraseña del configurador es visible en la terminal; usa una exclusiva para este entorno.

Vite escucha en el puerto 5180 y envía `/api` y WebSockets al emulador Wrangler en 8790. El servidor de Node solo se utiliza en desarrollo: producción usa Pages y Workers. Los datos locales se conservan en `.wrangler`, bajo `apps/worker`.

## Uso del docente

1. Entra a `/admin` e inicia sesión.
2. Pulsa **Nueva partida**. Elige nombre, duración (5–20 minutos, quince por defecto), modalidad y límites.
3. En la sala, pulsa **Generar enlace de ingreso**. Aparece una URL visible, con botones **Copiar enlace** y **Abrir ingreso**. También hay un QR y un código de seis caracteres.
4. Comparte el enlace. Abre directamente el ingreso de esa sala; cada estudiante escribe su apodo y elige equipo si corresponde. No necesita correo ni registro.
5. Puedes crear equipos, asignar integrantes, expulsar participantes y cerrar/reabrir ingresos antes del inicio. El nombre del equipo y los apodos son únicos dentro de la sala.
6. **Iniciar partida** envía una preparación de tres segundos. Después comienza el tiempo efectivo.
7. **Pausar** congela el reloj y bloquea respuestas. **Reanudar** recalcula el cierre. **Finalizar ahora** termina la partida para todos.
8. **Proyección** abre `/presentacion/CODIGO`, una vista pública sin controles administrativos ni respuestas privadas.
9. El historial permite reabrir los resultados y **Descargar CSV**, con separador de punto y coma, BOM UTF-8 y protección de fórmulas para Excel. El podio permite **Guardar imagen** en PNG.

Un enlace `localhost` funciona en el computador que ejecuta el servidor. Para compartir por Internet, hay que desplegar el proyecto. Para pruebas en Wi-Fi local, ajusta `APP_ORIGIN` al origen LAN exacto, por ejemplo `http://192.168.1.10:5180`, usa esa dirección en todos los dispositivos y permite los puertos en el firewall. Los enlaces y QR se generan con el origen que abrió el docente.

## Experiencia del estudiante

La pantalla muestra una sola cámara, el enunciado y los controles necesarios. **Ver marcador** y **Bitácora** son opciones secundarias. Para conectar piezas, toca una pieza y luego el destino; también puedes arrastrar con mouse. Los campos numéricos admiten `5`, `2.5`, `2,5` y `5/2`. La pista se solicita explícitamente y reduce la bonificación de la cámara.

El progreso se recupera al recargar o reconectar desde el mismo navegador. Las cookies HttpOnly identifican al participante. Borrar las cookies, cambiar de perfil o pasar a un dispositivo nuevo no recupera una identidad solo por su apodo. Una segunda pestaña sustituye la conexión autoritativa de la primera. No se admiten ingresos nuevos después de iniciar.

En equipos, todos ven el mismo progreso y puntaje; cada paso puntúa una sola vez. En modalidad mixta hay clasificaciones y podios separados. Terminar antes permite esperar el cierre global, sin terminar la partida de los demás.

## Organización

```text
apps/
  web/
    src/main.tsx           interfaz, cámaras SVG, superficie y controles
    src/style.css          diseño responsive y movimiento reducido
    functions/api/         proxy de Pages al Worker mediante service binding
    public/                cabeceras de seguridad
    vite.config.ts
    wrangler.jsonc         configuración de Pages
  worker/
    src/index.ts           API, sesiones, Registry y GameRoom
    src/engine.ts          estados, puntuación, cronómetro y clasificación
    wrangler.jsonc         Worker y migración de Durable Objects SQLite
packages/
  shared/index.ts          contratos y esquemas Zod
  math/index.ts            catálogo, soluciones y validación; solo servidor
tests/
  math.test.ts             verificación independiente de las 16 variantes
  engine.test.ts           reloj, concurrencia, puntos y autorización lógica
  e2e/game.spec.ts         navegadores, móvil, invitación y recorrido completo
  security.mjs            integración de sesiones y permisos
  load.mjs                30 conexiones WebSocket y partida de cinco minutos
scripts/                  configuración local y ejecutor Wrangler
docs/                     arquitectura, reglas, API, despliegue y evidencias
```

## Tecnologías y decisiones

React 19, TypeScript estricto, Vite, Lucide, KaTeX, QRCode React, Zod, Workers, Durable Objects SQLite y WebSockets hibernables. Vitest, Playwright, ESLint y Prettier para calidad. Se usa SVG y CSS para cuatro mecanismos distintos, controles accesibles y una superficie matemática calculada; Phaser y un motor 3D no aportan valor a estas mecánicas y aumentarían la carga. El estado de React es suficiente para esta aplicación. El historial vive en el Durable Object de la sala y el índice en Registry; no requiere D1 ni migraciones SQL externas.

El gráfico del núcleo proyecta realmente `z=xy` y el arco `x²+y²=C` en el primer cuadrante. Su deslizador cambia el punto factible y los valores mostrados; no modifica el resultado oficial.

## Validación matemática

Ocho variantes de rectángulos: perímetros `12,16,20,24,28,32,36,40`. Ocho variantes del núcleo: recursos cuadrados `8,18,32,50,72,98,128,162`. Las primeras tres cámaras comparten una variante de rectángulo y la última utiliza una variante distinta de circunferencia; todos los participantes de una sala reciben las mismas variantes.

El servidor verifica dominio positivo, factibilidad, regularidad de la restricción, derivadas, ambas ecuaciones de Lagrange, valor objetivo e interpretación del máximo. No ejecuta expresiones: un parser limitado acepta únicamente números y fracciones. Tolerancia relativa/absoluta `1e-5 × max(1, |esperado|)`. Las pruebas comprueban gradientes por diferencias finitas y comparan puntos factibles independientes. Este catálogo contiene máximos; no presenta puntos estacionarios como mínimos ni inventa mínimos alcanzados en dominios abiertos.

La solución oficial no se importa al frontend. El payload omite el parámetro interno de solución y utiliza identificadores aleatorios para las piezas, sin enviar su correspondencia con los destinos. Los candidatos y las etiquetas necesarias para jugar sí son públicos. Como en cualquier actividad matemática, no es posible impedir que alguien resuelva el problema con ayuda externa; la protección cubre la integridad del servidor.

## Pruebas y compilación

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

`build` compila el frontend y empaqueta el Worker en modo **dry-run**: no publica ni modifica recursos Cloudflare. El artefacto web está en `apps/web/dist`.

Para pruebas de navegador e integración, mantén `npm run dev` en otra terminal. Con una contraseña propia, configura `TEST_ADMIN_PASSWORD` en la terminal de pruebas (no la guardes en archivos versionados). Para un entorno nuevo de pruebas, `node scripts/test-setup.mjs` genera una contraseña aleatoria en archivos locales ignorados. No sobrescribe credenciales existentes.

```powershell
npx playwright install chromium
npm run test:e2e
node tests/security.mjs
npm run test:load
```

La carga dura cinco minutos efectivos más ingreso, cuenta regresiva y pausa. No edites ni reinicies el Worker durante esa ejecución. Usa un directorio de datos de pruebas y no ejecutes esta carga contra un aula en vivo. `TEST_URL` permite apuntar los scripts de integración a otro origen, siempre que el Worker tenga ese mismo `APP_ORIGIN` autorizado.

Consulta [el informe de aceptación](docs/aceptacion.md), [las reglas](docs/reglas.md), [la arquitectura](docs/arquitectura.md), [la API](docs/api.md) y [la guía Cloudflare](docs/despliegue.md). Las pruebas sobre emulador local no sustituyen una prueba WAN ni la revisión en teléfonos físicos.

## Historial y privacidad

Se conservan salas, integrantes, eventos acotados, progreso y resultados durante 30 días desde la creación. Las alarmas eliminan el estado al expirar; el índice se depura diariamente. **Eliminar sala y resultados** permite borrado administrativo inmediato. Solo se piden apodos. No se registran contraseñas ni tokens en las evidencias. La sesión administrativa dura ocho horas y se revoca al cerrar sesión; la del estudiante dura 24 horas. Para uso multiinstitucional se requieren identidades docentes y aislamiento por organización adicionales: este despliegue corresponde a una instalación compartida por un único administrador.

## Problemas frecuentes

- **No inicia sesión:** ejecuta `npm run setup`, reinicia Wrangler y usa la contraseña que elegiste. Cinco intentos fallidos bloquean ese origen de red durante 15 minutos; un acceso exitoso reinicia el contador.
- **403 de origen:** el origen completo debe coincidir con `APP_ORIGIN`, incluido esquema y puerto. No mezcles `localhost`, `127.0.0.1` y la dirección LAN.
- **La sala no aparece:** comprueba el código y que no haya expirado o sido borrada. Las salas locales y las publicadas tienen almacenamiento independiente.
- **Otra pestaña tomó el control:** continúa en la última pestaña o recarga la que quieras usar.
- **BACKEND no existe en Pages:** verifica el service binding hacia `lagrange-escape-api`, el despliegue previo del Worker y la carpeta `apps/web/functions`.
- **Puerto ocupado:** cierra el servidor anterior antes de iniciar otro. Vite usa puerto estricto para evitar enlaces con un origen equivocado.
- **Sin Internet durante instalación:** vuelve a ejecutar `npm ci` cuando npm y las descargas de Playwright sean accesibles. No se requieren servicios externos para el juego local una vez instalado; las fuentes visuales tienen fallback del sistema.
- **Advertencia `Request.cf` en el emulador sin Internet:** Wrangler puede usar un objeto local de sustitución; verifica la conectividad antes de probar condiciones de producción.

No se ha publicado un dominio ni creado recursos en una cuenta real como parte de esta entrega.

## Interacción guiada

LU acompaña cada cámara con instrucciones contextuales. Toca los objetos del laboratorio para examinarlos; en las conexiones puedes elegir primero la pieza o primero su destino. La bóveda muestra el jardín mientras ajustas dimensiones y ofrece controles +/− y teclado matemático opcional. En el núcleo puedes tocar o deslizar sobre el arco y copiar ese punto como candidato, sin enviar aún tu respuesta. Los compañeros pueden enviarse señales predefinidas dentro de su equipo. Estas señales no suman puntos ni cuentan como pistas.

## Misión universitaria Atlas

Cada estudiante elige uno de seis personajes de investigación al entrar. El personaje se guarda en el servidor y aparece con su apodo; en equipos se muestran compañeros reales. El laboratorio contiene cuatro estaciones ilustradas y una narrativa aplicada: recuperar un recinto experimental mediante modelado, condiciones de Lagrange, calibración y optimización energética. Los mecanismos se iluminan por objetivos confirmados y el personaje se desplaza al operar los controles. En computador la estación y los controles se presentan lado a lado. Abre «¿Para qué sirve este cálculo?» para consultar el objetivo científico de cada cámara.

## Móvil y partidas ampliadas

Las vistas Laboratorio y Resolver separan el escenario y los controles en móvil conservando las entradas. Las partidas nuevas duran 15 minutos por defecto, configurables de 5 a 20. La bóveda exige deducir x=y, calcular x+y y justificar el máximo. El núcleo requiere verificar regularidad y evaluar otro punto factible. El tiempo de las partidas ya iniciadas se conserva.
