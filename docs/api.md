# API y protocolo v1

Todas las rutas llevan prefijo `/api`. El frontend utiliza el mismo origen para HTTP y WebSockets. Respuestas JSON con `Cache-Control:no-store`. Errores: `{error:string}`; HTTP 400 para datos o transiciones inválidas, 401 sin sesión administrativa/de participante cuando corresponde, 403 para origen o permiso inválido, 404 sala inexistente, 405 método incorrecto, 409 conflicto de ingreso y 429 por límites. Las escrituras requieren `Origin` idéntico a `APP_ORIGIN` y cuerpos de máximo 4096 bytes.

| Método y ruta               | Autorización                           | Entrada y resultado                                                                                          |
| --------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| POST `/login`               | Público, origen y límite de intentos   | `{password}` → cookie `le_admin` HttpOnly, sin devolver token en JSON                                        |
| GET `/session`              | Cookie admin                           | `{admin:true}` o 401                                                                                         |
| POST `/logout`              | Cookie, origen                         | Revoca el token y elimina cookie                                                                             |
| POST `/rooms`               | Admin                                  | Configuración validada por `configSchema` → 201 `{code}`                                                     |
| GET `/rooms`                | Admin                                  | Snapshots de salas conservadas, incluido historial                                                           |
| GET `/rooms/:code/snapshot` | Público o cookie de participante/admin | Estado permitido para esa identidad; nunca tokens o respuestas numéricas oficiales                           |
| POST `/rooms/:code/join`    | Público, origen, sala abierta          | `{nickname,team?,newTeam?}` → 201 `{id}` y cookie HttpOnly por sala; una sesión existente conserva identidad |
| GET `/rooms/:code/session`  | Cookie de participante de esa sala     | `{id}`; 401 si inválida, expirada o expulsada                                                                |
| GET `/rooms/:code/ws`       | Handshake con origen permitido         | Upgrade WebSocket autenticado por cookies. `view=public` siempre público; `view=admin` requiere sesión admin |
| POST `/rooms/:code/control` | Admin                                  | `{command:"start"                                                                                            | "pause" | "resume" | "finish" | "toggle"}`; inicio manual y transiciones verificadas |
| POST `/rooms/:code/config`  | Admin, solo espera                     | Configuración completa; rechaza límites inferiores a ocupación                                               |
| POST `/rooms/:code/team`    | Admin, solo espera                     | `{name}` crea equipo; `{playerId,teamId}` mueve integrante a un equipo existente                             |
| POST `/rooms/:code/kick`    | Admin                                  | `{id}` invalida credencial y conexión del participante                                                       |
| GET `/rooms/:code/export`   | Admin                                  | CSV con puntuaciones y resultados por cámara                                                                 |
| POST `/rooms/:code/delete`  | Admin                                  | Borra estado e historial y cierra sockets                                                                    |

Configuración: `title` de 2–28 caracteres; `duration` entero 5–20, por defecto 15; `mode` individual/teams/mixed; `maxPlayers` 1–30, por defecto 30; `teamSize` 2–30, por defecto 30 (flexible, limitado por el cupo total de la sala); booleanos `allowTeams`, `hints`, `sound`, `ranking`. El administrador siempre inicia manualmente. Nombres aceptan letras Unicode, números, espacio, punto, guion y guion bajo. No se permite HTML.

## Mensajes del estudiante

```json
{
  "v": 1,
  "id": "UUID de acción",
  "seq": 1,
  "type": "answer",
  "stage": 0,
  "data": { "target": "objective", "piece": "identificador aleatorio de pieza" }
}
```

`type`: `ready` cambia el estado de preparación en espera; `hint` pide una pista autorizada para la cámara actual; `answer` somete respuesta; `signal` envía una señal predefinida al equipo sin puntuar (idea/help/cheer, máximo una cada dos segundos por equipo); `snapshot` solicita resincronización sin consumir secuencia. No se admite rol, puntaje, hora ni corrección declarada por cliente. Los campos extra se rechazan. `nextSeq` del snapshot es la secuencia que el cliente debe usar. IDs repetidos recientes son idempotentes; secuencias viejas se rechazan. Las secuencias son por participante y el progreso por participante/equipo, por lo que dos miembros pueden colaborar sin colisionar en la numeración.

Cámaras 1–2: `{target,piece}`. Cámara 3: `{x,y,lambda,sum,relation,proof}`. Cámara 4: `{objective,constraint,eqx,eqy,x,y,lambda,value,interpretation,regularity,probe}`; todos los valores son strings acotados y se validan en servidor. Cada socket admite hasta 40 mensajes en diez segundos y la sala hasta 75 conexiones incluyendo vistas; el objetivo de alumnos sigue siendo 30.

## Mensajes del servidor

- `{type:"snapshot",data:Snapshot}` al conectar y solicitar resincronización.
- `{type:"patch",v:1,seq,data:Partial<Snapshot>}` con campos cambiados desde el último envío a ese socket. Tras hibernación puede enviarse un nuevo snapshot completo.
- `{type:"error",message,nextSeq?}` seguido de snapshot para recuperar estado y secuencia.

El snapshot expresa conectados/desconectados, equipos, preparación, reloj, inicio, pausa, reanudación, validación, progreso, clasificación, finalización y podio mediante estado tipado. `progress`, `problem`, `you` y `nextSeq` solo están presentes para el participante autorizado. La proyección no recibe eventos ni respuestas privadas. Las posiciones oficiales se obtienen del servidor; el navegador solo las representa.

Cierres: 4001 sesión expirada/expulsión/borrado, 4002 otra pestaña asumió control, 4003 acción sin permiso, 4008 exceso de frecuencia, 1009 mensaje demasiado grande. El cliente vuelve a conectar con backoff ante interrupciones de red; no insiste si la identidad fue revocada o sustituida.
