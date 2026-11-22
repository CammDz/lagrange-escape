# Reglas y fundamentos matemáticos

## Tiempo y participación

Quince minutos por defecto; se permite configurar de cinco a veinte minutos enteros. La preparación inicial de tres segundos, la sala de espera, las pausas y el podio no consumen tiempo efectivo. Un único reloj en el Durable Object decide cuándo se acepta una respuesta. Al agotarse el tiempo, la alarma finaliza aunque no haya navegadores conectados. Las acciones se ordenan por llegada y se evalúan con la hora del servidor al comenzar su procesamiento; una acción que llega después del límite no puntúa.

El ingreso se cierra al iniciar. Los participantes ya inscritos pueden reconectar durante la partida. Un equipo y un individual resuelven exactamente los mismos objetivos; los integrantes del equipo comparten el avance, sin multiplicar puntos por integrante. La clasificación oficial se divide en categorías individuales y de equipos.

## Cámaras

1. **Reactor de restricciones:** coloca variables y dominio, objetivo, restricción y constante. Un distractor confunde función objetivo con recurso. Cada conexión correcta enciende parte del reactor.
2. **Circuito del gradiente:** conecta siete relaciones: `fx`, `fy`, `gx`, `gy`, dos ecuaciones de Lagrange y la restricción. Expresiones con el mismo valor, como `gx=gy=2`, se consideran equivalentes.
3. **Bóveda:** introduce `x`, `y` y `λ`. Se comprueban positividad, perímetro y las dos ecuaciones del gradiente antes de abrirla.
4. **Núcleo:** modela un problema distinto con restricción circular, construye las dos ecuaciones, calcula el candidato y el valor óptimo, y justifica el máximo con una desigualdad. El arco gráfico permite explorar puntos factibles.

## Soluciones del catálogo

Para un rectángulo con perímetro `P=4n`, el sistema es `y=2λ`, `x=2λ`, `2x+2y=P`. La única solución positiva es `x=y=n`, `λ=n/2`, con área `n²`. La restricción es regular: su gradiente es `(2,2)`. Como `xy=n²−(x−n)²`, el valor no puede superar `n²`; no basta con afirmar que el punto es estacionario.

Para `xy` con `x²+y²=2n²`, el sistema es `y=2λx`, `x=2λy` y la restricción. En el dominio positivo se obtiene `x=y=n`, `λ=1/2`. El gradiente `(2x,2y)` es distinto de cero. La desigualdad `(x−y)²≥0` demuestra `2xy≤x²+y²=2n²`, con igualdad solo en `x=y`. Es un máximo global. El ínfimo cero no se alcanza porque el dominio excluye los ejes.

## Puntaje

Las bases por cámara son `150,250,250,350`, total 1000. Cada error resta 10 puntos de la base de esa cámara, hasta un piso del 50 % de su base. Al completar una cámara se concede una bonificación `max(0,25−5×errores)` si no se usó pista; con pista, la bonificación es cero. Máximo total: 1100. No se premia la velocidad con puntos; el tiempo solo interviene al desempatar, después del conocimiento y las ayudas. No hay puntajes negativos.

Una pista se contabiliza una sola vez por cámara; volver a leerla no duplica penalizaciones. Volver a conectar un objetivo completado o reenviar el mismo identificador de acción no suma ni resta puntos. Una cámara avanzada no se puede volver a puntuar. Las acciones de un equipo se serializan y comparten el mismo conjunto de objetivos completados.

## Desempates y podio

Orden: mayor puntaje, más cámaras, más pasos correctos, menos pistas y menor tiempo efectivo del último objetivo correcto. Si todo coincide, se comparte posición con clasificación de competición: `1,1,3`. Se muestran los participantes elegibles con posición hasta tres; un empate puede producir más de tres ganadores visibles. Nunca se agregan personas o equipos ficticios para llenar el podio. Los equipos vacíos y los participantes expulsados no son elegibles.

## Ayudas y accesibilidad

Las piezas se pueden conectar con toque/clic o arrastre. Botones operables por teclado, foco visible, mensajes en regiones de estado, SVG con descripción, alternativa textual al gráfico y controles para sonidos y movimiento reducido. El movimiento reducido respeta además la preferencia del sistema. El sonido comienza apagado y requiere una interacción del usuario. No se han certificado WCAG ni compatibilidad con todos los lectores de pantalla.

## Equipos de tamaño flexible

Una misma sala admite equipos de 2, 3, 4 o más integrantes. No se exige un tamaño exacto ni llenar los cupos para iniciar. Las salas nuevas usan Flexible por defecto, hasta el cupo total de la sala (máximo 30). El docente puede establecer un máximo opcional; ese máximo no obliga a todos los equipos a tener la misma cantidad. El panel administrativo muestra el número actual de integrantes de cada equipo. Prueba real: node tests/teams.mjs; evidencia en teams-results.json.

## Justificación adicional

La bóveda requiere x=y, x+y=P/2 y la prueba de cota cuadrática. El núcleo exige regularidad de la restricción y el rendimiento del punto factible (7n/5,n/5), cuyo producto es 7n²/25 y cuya suma de cuadrados es 2n². Las respuestas se verifican en el servidor, sin esperas artificiales.
