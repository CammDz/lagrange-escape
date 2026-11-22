import { useEffect, useRef, useState } from "react";
import {
  Bot,
  ChevronRight,
  Hand,
  Lightbulb,
  MapPin,
  MessageCircle,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { Action, Snapshot } from "../../../packages/shared";
import { CampusWorld } from "./campus-world";

const missions = [
  {
    name: "Dale vida al reactor",
    guide:
      "Vamos por partes: elige una pieza y toca dónde crees que va. Puedes comenzar por cualquiera de los dos.",
    object: "Examinar reactor",
    detail:
      "Necesita cuatro conexiones: variables, objetivo, restricción y recurso. Cada conexión correcta enciende una parte.",
    cta: "Conectar las piezas",
  },
  {
    name: "Tiende un puente de energía",
    guide:
      "Cada derivada es un cable. Une las expresiones con sus conectores para reparar el circuito.",
    object: "Examinar circuito",
    detail:
      "Conecta las derivadas de f y de g. Después construye las dos ecuaciones con λ y cierra la restricción.",
    cta: "Reparar el circuito",
  },
  {
    name: "Encuentra la combinación",
    guide:
      "La bóveda necesita tres valores que funcionen juntos. Ajusta las dimensiones y comprueba tu combinación.",
    object: "Examinar bóveda",
    detail:
      "x e y deben respetar el perímetro. λ debe hacer verdaderas las dos ecuaciones del gradiente. Puedes escribir fracciones.",
    cta: "Calibrar la bóveda",
  },
  {
    name: "Encuentra el equilibrio",
    guide:
      "Mueve el punto sobre la curva y observa la energía. Luego conecta el modelo y explica por qué el resultado es un máximo.",
    object: "Examinar núcleo",
    detail:
      "El punto azul siempre cumple la restricción. La altura muestra xy. Explorar no envía una respuesta ni cambia tus puntos.",
    cta: "Explorar la superficie",
  },
];
export function MissionScene({
  s,
  draft,
  onOperate,
}: {
  s: Snapshot;
  draft?: Record<string, string>;
  onOperate: () => void;
}) {
  const p = s.progress!,
    stage = Math.min(p.stage, 3),
    m = missions[stage];
  const [inspect, setInspect] = useState<"object" | "door" | null>(null),
    [help, setHelp] = useState(false),
    [effect, setEffect] = useState(""),
    [operating, setOperating] = useState(false);
  const prior = useRef({
    correct: p.correct,
    errors: p.errors,
    stage: p.stage,
    score: p.score,
  });
  useEffect(() => {
    const old = prior.current;
    if (p.stage > old.stage)
      setEffect(`¡Cámara superada! +${p.score - old.score} puntos`);
    else if (p.correct > old.correct) setEffect("¡Conexión correcta!");
    else if (p.errors > old.errors)
      setEffect("Casi. Revisa la pista del sistema y vuelve a intentar.");
    prior.current = {
      correct: p.correct,
      errors: p.errors,
      stage: p.stage,
      score: p.score,
    };
    const t = setTimeout(() => setEffect(""), 2600);
    return () => clearTimeout(t);
  }, [p.correct, p.errors, p.stage, p.score]);
  useEffect(() => {
    setInspect(null);
    setOperating(false);
  }, [p.stage]);
  useEffect(() => {
    if (draft && Object.keys(draft).length) setOperating(true);
  }, [draft]);
  const controls = () => {
    setInspect(null);
    setOperating(true);
    onOperate();
    requestAnimationFrame(() =>
      document.querySelector(".puzzle")?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      }),
    );
  };
  return (
    <section className={`mission-experience chamber-color-${stage}`}>
      <div className="guide-message">
        <span className="guide-avatar">
          <Bot size={24} />
        </span>
        <div>
          <strong>LU · Tu copiloto</strong>
          <p>
            {p.stage >= 4
              ? "¡Lo logramos! La salida está abierta. Tu resultado ya está guardado."
              : m.guide}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Cómo jugar"
          aria-expanded={help}
          onClick={() => setHelp(!help)}
        >
          <Lightbulb size={20} />
        </button>
      </div>
      {help && (
        <div className="how-to-play">
          <h2>Tú llevas el control</h2>
          <ol>
            <li>Toca un objeto del laboratorio para explorar.</li>
            <li>
              En las conexiones, elige una pieza y su destino, en cualquier
              orden.
            </li>
            <li>Lee la respuesta del sistema. Puedes corregir y seguir.</li>
          </ol>
          <p>
            Las pistas matemáticas se piden con «Pista» y reducen la
            bonificación. Esta guía de manejo no cambia tu puntaje.
          </p>
          <button className="secondary" onClick={() => setHelp(false)}>
            Entendido
          </button>
        </div>
      )}
      <div className="interactive-lab">
        <CampusWorld
          s={s}
          draft={draft}
          inspecting={inspect === "object" || operating}
          celebrating={!!effect && !effect.startsWith("Casi")}
        />
        {p.stage < 4 && (
          <>
            <button
              className="scene-hotspot object-hotspot"
              onClick={() => setInspect("object")}
            >
              <Hand size={17} />
              <span>{m.object}</span>
            </button>
            <button
              className="scene-hotspot door-hotspot"
              onClick={() => setInspect("door")}
            >
              <MapPin size={16} />
              <span>La salida</span>
            </button>
            <button
              className="scene-objective"
              onClick={controls}
              aria-label="Abrir controles de la cámara"
            >
              <Zap size={16} />
              <span>{m.name}</span>
              <b>
                {p.done.length}/{[4, 7, 1, 1][stage]}
              </b>
            </button>
          </>
        )}
        {inspect && (
          <div className="inspection-card">
            <button
              className="icon-button close-inspection"
              aria-label="Cerrar inspección"
              onClick={() => setInspect(null)}
            >
              <X size={17} />
            </button>
            <span className="eyebrow">
              {inspect === "object" ? "OBJETO DESCUBIERTO" : "PUERTA DE SALIDA"}
            </span>
            <h3>
              {inspect === "object"
                ? m.name
                : "Cada cámara te acerca a la salida"}
            </h3>
            <p>
              {inspect === "object"
                ? m.detail
                : `Has superado ${p.stage} de 4 cámaras. Completa el mecanismo actual para avanzar; el tiempo es compartido por toda la sala.`}
            </p>
            <button className="primary" onClick={controls}>
              {m.cta}
              <ChevronRight size={17} />
            </button>
          </div>
        )}
        {effect && (
          <div
            key={effect}
            className={`discovery-toast ${effect.startsWith("Casi") ? "retry" : ""}`}
            role="status"
          >
            {effect.startsWith("Casi") ? (
              <Lightbulb size={20} />
            ) : (
              <Sparkles size={20} />
            )}{" "}
            {effect}
          </div>
        )}
      </div>
    </section>
  );
}
export function TeamCompanion({
  s,
  send,
}: {
  s: Snapshot;
  send: (type: Action["type"], data?: Record<string, string>) => void;
}) {
  const you = s.players.find((p) => p.id === s.you),
    team = s.teams.find((t) => t.id === you?.teamId);
  const [open, setOpen] = useState(false);
  if (!team) return null;
  const signal = s.progress?.signal;
  const fresh = signal && s.serverNow - signal.at < 15000;
  return (
    <div className="team-companion">
      <button
        className="team-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Users size={17} />
        <strong>{team.name}</strong>
        <span>{team.members.length} exploradores</span>
        <MessageCircle size={16} />
      </button>
      {open && (
        <div className="team-room">
          <p>
            Comparten conexiones, pistas y puntos. Cada aporte cuenta una sola
            vez.
          </p>
          <div className="team-members">
            {team.members.map((id) => {
              const p = s.players.find((p) => p.id === id);
              return p ? (
                <span key={id}>
                  <i className={`online-dot ${p.connected ? "active" : ""}`} />
                  {p.nickname}
                  {id === s.you ? " (tú)" : ""}
                </span>
              ) : null;
            })}
          </div>
          <div className="team-signals">
            {[
              ["idea", "Tengo una idea"],
              ["help", "Necesito ayuda"],
              ["cheer", "¡Vamos, equipo!"],
            ].map(([signal, label]) => (
              <button
                className="secondary"
                key={signal}
                disabled={s.status === "finished"}
                onClick={() => send("signal", { signal })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {fresh && (
        <p className="team-signal" role="status">
          <MessageCircle size={15} />
          <strong>{signal.from}:</strong> {signal.text}
        </p>
      )}
    </div>
  );
}
export function draftNumber(s: string) {
  const m =
    /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*\/\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)))?$/.exec(
      (s || "").trim().replace(",", "."),
    );
  return m ? Number(m[1]) / (m[2] ? Number(m[2]) : 1) : NaN;
}
export function MathKeypad({
  field,
  onKey,
}: {
  field: string;
  onKey: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="math-keypad">
      <button
        className="ghost"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Ocultar teclado matemático" : "Abrir teclado matemático"}
      </button>
      {open && (
        <>
          <p>
            Escribiendo en <strong>{field}</strong> · Toca otro campo para
            cambiar
          </p>
          <div className="keypad-keys">
            {[
              "7",
              "8",
              "9",
              "/",
              "4",
              "5",
              "6",
              "−",
              "1",
              "2",
              "3",
              "borrar",
              "0",
              ".",
              "limpiar",
            ].map((key) => (
              <button type="button" key={key} onClick={() => onKey(key)}>
                {key === "borrar" ? "⌫" : key === "limpiar" ? "Limpiar" : key}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
export function VaultPreview({
  resource,
  values,
}: {
  resource: number;
  values: Record<string, string>;
}) {
  const x = draftNumber(values.x),
    y = draftNumber(values.y),
    valid = Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0;
  const scale = valid ? Math.min(210 / x, 105 / y) : 1,
    w = valid ? x * scale : 130,
    h = valid ? y * scale : 75;
  return (
    <div className="vault-preview">
      <svg
        viewBox="0 0 280 155"
        role="img"
        aria-label="Vista de las dimensiones ingresadas"
      >
        <defs>
          <pattern
            id="garden-grid"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <path d="M16 0H0V16" stroke="#4ade8030" fill="none" />
          </pattern>
        </defs>
        <rect
          x={(280 - w) / 2}
          y={(155 - h) / 2}
          width={w}
          height={h}
          rx="6"
          fill="url(#garden-grid)"
          stroke="#4ade80"
          strokeWidth="3"
        />
        <text
          x="140"
          y={(155 - h) / 2 - 10}
          textAnchor="middle"
          fill="#b0ecc7"
          fontSize="13"
        >
          x = {values.x || "?"}
        </text>
        <text
          x="140"
          y={(155 + h) / 2 + 22}
          textAnchor="middle"
          fill="#b0ecc7"
          fontSize="13"
        >
          y = {values.y || "?"}
        </text>
      </svg>
      <div>
        <span className="eyebrow">TU DISEÑO EN TIEMPO REAL</span>
        <h3>
          {valid
            ? `Área: ${(x * y).toLocaleString("es-CO", { maximumFractionDigits: 3 })} m²`
            : "Dale forma al jardín"}
        </h3>
        <p>
          {valid
            ? `Cerca utilizada: ${(2 * x + 2 * y).toLocaleString("es-CO", { maximumFractionDigits: 3 })} de ${resource} m`
            : "Al escribir x e y verás cómo cambian el jardín y la cerca utilizada."}
        </p>
        <small>
          Esta vista te ayuda a explorar. El servidor comprueba la combinación
          completa.
        </small>
      </div>
    </div>
  );
}
