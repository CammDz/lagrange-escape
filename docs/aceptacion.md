# Informe de verificación

Actualizado: 22 de noviembre de 2026, hora de Colombia. Entorno: Windows, Node.js 24.16.0, Wrangler/workerd local, Vite y Chromium de Playwright. No se ejecutó un despliegue remoto ni se usaron estudiantes reales.

## Compilación y análisis estático

- `npm run typecheck`: aprobado, TypeScript estricto sin errores.
- `npm run lint`: aprobado, sin errores.
- `npm run build`: frontend compilado y Worker empaquetado en dry-run. Sin publicación.
- `npm audit`: cero vulnerabilidades tras actualizar KaTeX, Zod y Vitest. El lockfile conserva las versiones instaladas.
- Bundle web distribuido en archivos menores de 300 kB sin comprimir; JavaScript combinado aproximado 172 kB gzip y CSS aproximado 15 kB gzip, más fuentes a demanda. No se midieron FPS ni memoria en dispositivos físicos.

## Pruebas unitarias

`npm test`: **105 pruebas aprobadas** en dos archivos. Incluye 16 variantes matemáticas, parser numérico seguro, fracciones, dominio, regularidad y gradientes por diferencias finitas, comparación de puntos factibles, rechazo de valores incorrectos, diez minutos efectivos exactos, pausa, transición de estados, puntaje máximo, equipos, repetición de acciones, secuencias, clasificación, empates, CSV y ausencia de secretos en snapshots públicos.

## Navegadores, panel simplificado y enlaces

`npm run test:e2e`: **4 pruebas aprobadas**, con múltiples contextos de navegador reales. Se comprobó:

- Inicio de sesión docente y creación de sala.
- Botón **Generar enlace de ingreso**, URL visible e ingreso directo al campo de apodo.
- Dos estudiantes en navegadores aislados, uno con viewport y eventos táctiles móviles.
- Estado preparado, inicio con cuenta regresiva y pausa/reanudación observada en ambos.
- Interacción táctil con pieza y destino.
- Vista estudiantil centrada en la cámara; marcador oculto inicialmente y bitácora secundaria.
- Envío incorrecto con retroalimentación, recorrido completo de cuatro cámaras, sistema del núcleo, fracciones e interpretación del máximo.
- Recarga con progreso conservado, finalización administrativa, clasificación y podio oficiales.
- Proyección pública sin controles administrativos.
- Ausencia de desbordamiento horizontal en inicio y juego para **320, 375, 390, 430, 768, 1024 y 1440 px**.

Evidencias: `inicio-desktop.png`, `inicio-mobile.png`, `estudiante-desktop.png`, `estudiante-mobile.png`, `podio-desktop.png` y `resultado-mobile.png` en esta carpeta. Las capturas corresponden a participantes creados por las pruebas, no a estadísticas ni usuarios de producción.

## Integración de seguridad

`node tests/security.mjs`: **12 comprobaciones aprobadas**; detalle en [security-results.json](security-results.json). Se verificaron autorización de admin/historial, CSRF, falsificación de cabeceras, apodos duplicados, credenciales manipuladas, aislamiento entre salas, privacidad del estado público, sustitución de pestañas, configuración bloqueada al iniciar, protocolo sin puntajes arbitrarios, replay idempotente, expulsión y revocación de sesión administrativa. Algunas comprobaciones agrupan varias aserciones bajo un mismo nombre.

Los tokens y contraseñas no se escriben en este informe. Las pruebas no constituyen una auditoría profesional independiente de seguridad.

## Carga con 30 conexiones

El script `tests/load.mjs` realiza una partida real sobre el emulador con 30 conexiones WebSocket: 15 individuales y tres equipos de cinco personas. Comprueba inicio, pausa, bloqueo de respuestas, concurrencia, resolución completa, reconexión, alarma de cierre, categorías finales y exportación.

**Ejecución final aprobada:** 30 participantes, 15 individuales, tres equipos, 225 acciones registradas y cinco minutos efectivos. Duración total de la prueba: 310 817 ms, incluidos ingreso, cuenta regresiva y pausa. Latencia local mediana: 285,33 ms; percentil 95: 341,39 ms; máxima: 346,66 ms. Cero errores inesperados y dos errores de seguridad provocados intencionalmente. La alarma cerró la partida y se comprobaron clasificación, podio y CSV. Evidencia completa en [load-results.json](load-results.json).

La primera ejecución se invalidó por modificaciones/reinicios del Worker durante la espera del cierre y no se considera aprobada. No se extrapolan latencias del equipo local a redes móviles o a producción.

## Estado de criterios de aceptación

| Criterio                                          | Estado y evidencia                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Frontend/backend compilan; TypeScript             | Aprobado localmente, build y typecheck                                        |
| Admin autenticado, crea sala, código e invitación | Aprobado E2E e integración                                                    |
| Dos navegadores, individuales y equipos           | Aprobado E2E y pruebas de motor/integración                                   |
| Celular físico y computador en redes distintas    | **Pendiente externo**; solo emulación táctil local                            |
| Inicio sincronizado, pausa, reloj de ocho minutos | Aprobado E2E; exactitud de ocho minutos en pruebas del motor; carga usa cinco |
| Cuatro cámaras y matemática                       | Aprobado E2E y 16 variantes verificadas                                       |
| Retroalimentación y puntajes en servidor          | Aprobado motor, E2E e integración                                             |
| Ranking, empates y categorías                     | Aprobado motor y E2E                                                          |
| Reconexión sin pérdida                            | Aprobado recarga E2E y reconexión del script de carga                         |
| Finalización por alarma con 30 conectados         | Aprobado, partida de cinco minutos con 30 WebSockets; `load-results.json`     |
| Podio oficial y exportación                       | Aprobado E2E/motor/integración; imagen PNG implementada                       |
| Controles administrativos protegidos              | Aprobado en 12 comprobaciones de seguridad                                    |
| Móvil usable y sin desbordamiento                 | Aprobado Chromium con eventos táctiles y siete anchos                         |
| Safari/iPhone, Android físico, macOS/Linux        | **Pendiente externo**                                                         |
| Hibernación/reinicio en infraestructura real      | **Pendiente externo**; estado/adjuntos persistentes implementados             |
| Guía Cloudflare reproducible                      | Configuración y dry-run verificados; ejecución sobre cuenta real pendiente    |
| Carga WAN/producción                              | **Pendiente externo**                                                         |

## Alcance y límites

Se entrega una aplicación implementada y probada localmente, no una certificación de producción. La comprobación del enlace público depende de publicar primero la aplicación; un enlace `localhost` no permite entrar desde Internet. La instalación corresponde a un administrador compartido, sin multiinstitución ni cuentas docentes individuales. Los cambios de equipo se permiten antes de iniciar; el ingreso nuevo se bloquea al empezar. Se mantienen hasta 3000 eventos por sala y resultados durante 30 días. Las variantes son dos familias de máximos, con diferentes valores; no se afirma disponer de un generador algebraico universal ni de ejercicios de mínimos que no se hayan implementado.

## Mejoras interactivas verificadas

LU orienta cada cámara. Los objetos del laboratorio se pueden examinar. Las conexiones aceptan pieza o destino primero y permiten cancelar selección. La bóveda incluye controles +/−, representación del jardín y teclado opcional. El núcleo responde a Pointer Events y permite copiar x e y como candidato; las respuestas y puntajes continúan siendo autoritativos del servidor. Hay señales reales entre integrantes del mismo equipo, con límite de frecuencia y sin puntos ni penalizaciones de pistas. Las pruebas de carga de 30 clientes documentadas corresponden a la versión base anterior; no se repitieron después de esta actualización.

## Rediseño Atlas: misión universitaria y personajes

Se incorporaron seis personajes SVG seleccionables; la apariencia se valida en el servidor y se conserva en el Durable Object. El laboratorio representa únicamente al participante y a compañeros realmente inscritos en su equipo. Las poses y desplazamientos cambian al operar una estación o al recibir validaciones oficiales; no agregan puntos locales.

Las cuatro estaciones tienen gráficos propios: mesa holográfica de modelado, controlador con siete circuitos, recinto de cultivo y núcleo energético. El contexto enlaza el modelo del recinto, las condiciones del gradiente, la calibración factible y la demostración del máximo global. En escritorio el escenario y los controles están lado a lado; el contexto puede ampliarse y no bloquea el juego. En móvil se mantiene el control por toque y el diseño sin desbordamientos.

Las tres pruebas de navegador verifican elección de personaje, apariencia persistida y restaurada al recargar, movimiento al operar, presencia de un compañero real con apariencia distinta, cuatro cámaras, colaboración y siete anchos. Captura del laboratorio de equipo: atlas-laboratorio.png. La prueba unitaria adicional rechaza identificadores de avatar fuera del catálogo. Compilación y TypeScript aprobados; la carga de 30 conexiones sigue siendo la medición previa a estos cambios visuales, no una nueva medición de rendimiento gráfico.

## Ajuste móvil y duración

Probadas pestañas Laboratorio/Resolver, cámaras 3 y 4 completas a 390 px con campos de al menos 16 px y nuevas justificaciones. Duración predeterminada de 15 minutos y máximo de 20 verificados en pruebas de motor. La configuración histórica de ocho minutos sigue admitida. Se borraron 30 salas de prueba con aprobación de su lista exacta; se conservaron las partidas indicadas por el administrador. La contraseña local fue cambiada y se comprobó que la nueva autentica y la anterior se rechaza. No se incluye ninguna contraseña en la entrega de código.

## Correcciones del 22 de noviembre de 2026

105 pruebas unitarias, cuatro de navegador y 12 comprobaciones de integración de seguridad aprobadas. Verificado el reloj de 600 000 ms efectivos, el rechazo de duraciones distintas de diez y la normalización de salas antiguas en espera. Verificado ingreso solo con apodo también en modo equipos: el docente debe asignar los grupos antes de iniciar.

En navegador se compararon los extremos geométricos de las líneas con los centros reales de sus puertos, con error menor de 2 px a 320, 375, 390 y 430 px, incluyendo recarga y cambio de tamaño. Ambas piezas correctas quedan deshabilitadas; el servidor conserva los emparejamientos, impide reutilizar una pieza y admite las dos fichas equivalentes de derivada 2 como piezas distintas. Se probó la denegación de expulsiones en juego/pausa y después del cierre, manteniendo válida la sesión del participante; la expulsión previa al inicio sí invalida su credencial. Los tests de navegador y seguridad eliminan solamente las salas que ellos mismos crean.

La medición de carga conservada corresponde a la ejecución anterior de cinco minutos. El script de carga ahora está preparado para diez minutos, pero esa ejecución de diez minutos no se ha realizado en esta revisión; no se declara como aprobada.
