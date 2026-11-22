import { useId } from "react";
import type { Snapshot } from "../../../packages/shared";
export const characterNames = [
  "Índigo",
  "Cobre",
  "Jade",
  "Ámbar",
  "Coral",
  "Órbita",
];
const looks = [
  { skin: "#c98b65", hair: "#28213d", shirt: "#7863d9", short: true },
  { skin: "#8d593e", hair: "#211e2c", shirt: "#d58c4b", short: false },
  { skin: "#edbc98", hair: "#56332c", shirt: "#398f87", short: false },
  { skin: "#5f3b30", hair: "#211e29", shirt: "#d3a349", short: true },
  { skin: "#b97b58", hair: "#322131", shirt: "#bf647b", short: false },
  { skin: "#e1b69a", hair: "#64647d", shirt: "#5988b8", short: true },
];
export function Researcher({
  avatar = 0,
  pose = "idle",
  label = "",
  portrait = false,
}: {
  avatar?: number;
  pose?: "idle" | "work" | "celebrate";
  label?: string;
  portrait?: boolean;
}) {
  const c = looks[avatar % looks.length];
  return (
    <svg
      viewBox={portrait ? "10 0 100 112" : "0 0 120 190"}
      className={`researcher-art pose-${pose}`}
      role="img"
      aria-label={label || `Personaje ${characterNames[avatar % 6]}`}
    >
      <ellipse cx="60" cy="169" rx="33" ry="7" fill="#081525" opacity=".45" />
      {!portrait && (
        <g className="researcher-legs">
          <path
            d="M43 114l-4 41 15 1 7-35 5 35h15l-4-43"
            fill="#263347"
            stroke="#1c2538"
            strokeWidth="2"
          />
          <path
            d="M38 152l-5 11q3 5 24 1v-11M65 153v12h24q3-7-10-11"
            fill="#182332"
          />
          <path d="M37 163h19m10 1h21" stroke="#7290a8" strokeWidth="2" />
        </g>
      )}
      <path
        d="M45 57q15-8 30 0l11 62q-26 11-52 0Z"
        fill="#dfe9ed"
        stroke="#9aafbc"
        strokeWidth="1.5"
      />
      <path d="M51 53h18l8 61H43Z" fill={c.shirt} />
      <path
        d="M48 55l-9 12 13 12-6 37m25-61 9 12-13 12 7 37"
        fill="#f4f6f4"
        stroke="#a9bcc7"
        strokeWidth="1.5"
      />
      <path d="M52 44h16v15q-8 8-16 0Z" fill={c.skin} />
      <g className="researcher-arm rear-arm">
        <path
          d="M78 62q12 6 15 29l-11 4-14-27"
          fill="#dce8ed"
          stroke="#9bafbc"
          strokeWidth="1.5"
        />
        <path d="M84 89l-1 17q9 6 12-1l-2-18" fill={c.skin} />
      </g>
      <g className="researcher-arm front-arm">
        <path
          d="M41 61q-10 2-14 29l12 5 14-27"
          fill="#edf2f2"
          stroke="#a5bac5"
          strokeWidth="1.5"
        />
        <path d="M28 87l-2 17q6 9 12 1l1-15" fill={c.skin} />
        <rect
          x="22"
          y="98"
          width="20"
          height="27"
          rx="3"
          fill="#263c56"
          stroke="#78a5bb"
        />
        <path
          d="M27 104h10m-10 5h8m-8 5h10"
          stroke="#69e0e6"
          strokeWidth="1.4"
        />
      </g>
      <path
        d="M42 21q0-22 20-19 21-2 20 23l-3 15q-5 15-19 15-15-2-18-18Z"
        fill={c.skin}
      />
      <ellipse cx="41" cy="30" rx="4" ry="6" fill={c.skin} />
      <ellipse cx="80" cy="30" rx="4" ry="6" fill={c.skin} />
      {c.short ? (
        <path
          d="M41 26q-9-23 13-25 25-6 30 16l-4 12-7-14q-12 9-24 3l-7 14Z"
          fill={c.hair}
        />
      ) : (
        <>
          <path
            d="M39 31Q28 2 53 0q26-6 32 19l-3 27-9 4 3-30Q57 28 46 16l-1 36-10-7Z"
            fill={c.hair}
          />
          {avatar === 2 && <circle cx="76" cy="5" r="12" fill={c.hair} />}
        </>
      )}
      <path
        d="M49 29h5m13 0h5"
        stroke="#302a35"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path d="M60 31l-2 8h5" fill="none" stroke="#925e4d" strokeWidth="1.2" />
      <path
        d="M54 44q6 4 12 0"
        fill="none"
        stroke="#6d4640"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {(avatar === 0 || avatar === 3 || avatar === 5) && (
        <g fill="none" stroke="#35445d" strokeWidth="1.8">
          <rect x="45" y="25" width="12" height="10" rx="3" />
          <rect x="64" y="25" width="12" height="10" rx="3" />
          <path d="M57 29h7m-24-2h5m31 0h5" />
        </g>
      )}
      <path d="M72 78h11v17H72Z" fill="#89d8dd" stroke="#528e9b" />
      <path d="M74 82h7m-7 4h5" stroke="#eaffff" strokeWidth="1" />
      <circle cx="58" cy="85" r="2" fill="#7c90a2" />
      <circle cx="59" cy="99" r="2" fill="#7c90a2" />
    </svg>
  );
}
export function CharacterPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset className="character-picker">
      <legend>Elige tu personaje de investigación</legend>
      <div>
        {looks.map((_, i) => (
          <button
            type="button"
            key={i}
            aria-label={`Elegir personaje ${characterNames[i]}`}
            aria-pressed={value === i}
            className={value === i ? "chosen" : ""}
            onClick={() => onChange(i)}
          >
            <Researcher avatar={i} portrait />
            <span>{characterNames[i]}</span>
            {value === i && <b>✓</b>}
          </button>
        ))}
      </div>
      <small>
        Tu personaje te representa en el laboratorio. Todos tienen las mismas
        oportunidades.
      </small>
    </fieldset>
  );
}
const context = [
  {
    chapter: "01 / MODELADO",
    name: "El recinto experimental",
    goal: "Diseña el recinto de cultivo que aproveche la mayor área con la cerca disponible.",
    why: "Definir bien el objetivo y el recurso es el primer paso de cualquier decisión de ingeniería.",
    reward: "Plano experimental identificado",
  },
  {
    chapter: "02 / CONDICIONES",
    name: "La red de control",
    goal: "Conecta las condiciones de Lagrange que utilizará el controlador del laboratorio.",
    why: "Los gradientes alineados identifican candidatos donde ya no puedes mejorar sobre la restricción.",
    reward: "Red de control restaurada",
  },
  {
    chapter: "03 / CALIBRACIÓN",
    name: "La cámara de cultivo",
    goal: "Configura las dimensiones óptimas y el multiplicador para liberar el recinto.",
    why: "Resolver el sistema debe producir un diseño factible; un valor aislado no abre el mecanismo.",
    reward: "Recinto experimental calibrado",
  },
  {
    chapter: "04 / VALIDACIÓN",
    name: "El núcleo de energía",
    goal: "Optimiza dos canales de energía con un presupuesto cuadrático y demuestra el máximo.",
    why: "Una solución estacionaria no garantiza un máximo: necesitas una cota superior que se alcance.",
    reward: "Sistema energético estabilizado",
  },
];
export function MissionBriefing({
  stage = 0,
  waiting = false,
}: {
  stage?: number;
  waiting?: boolean;
}) {
  const c = context[Math.min(stage, 3)];
  if (!waiting)
    return (
      <details className="atlas-context">
        <summary>
          <span>{c.chapter}</span>
          <strong>{c.name}</strong>
          <small>¿Para qué sirve este cálculo?</small>
        </summary>
        <div>
          <p>{c.goal}</p>
          <p>{c.why}</p>
          <small>Resultado esperado: {c.reward}</small>
        </div>
      </details>
    );
  return (
    <section className={`atlas-briefing ${waiting ? "briefing-waiting" : ""}`}>
      <div className="atlas-badge">
        A<span>TLAS</span>
      </div>
      <div>
        <span className="eyebrow">
          {waiting ? "UNIVERSIDAD · LABORATORIO DE OPTIMIZACIÓN" : c.chapter}
        </span>
        <h2>{waiting ? "Recupera el laboratorio Atlas" : c.name}</h2>
        <p>
          {waiting
            ? "Una falla de control dejó el recinto experimental aislado. Tu grupo de investigación debe reconstruir el modelo, reparar el controlador, calibrar el cultivo y estabilizar la energía antes del cierre de seguridad."
            : c.goal}
        </p>
        {!waiting && <small>{c.why}</small>}
      </div>
      {!waiting && (
        <span className="mission-deliverable">
          OBJETIVO<span>{c.reward}</span>
        </span>
      )}
    </section>
  );
}
export function CampusWorld({
  s,
  inspecting = false,
  celebrating = false,
  draft = {},
}: {
  s: Snapshot;
  inspecting?: boolean;
  celebrating?: boolean;
  draft?: Record<string, string>;
}) {
  const uid = useId().replaceAll(":", ""),
    p = s.progress!,
    stage = Math.min(p.stage, 3),
    energy = p.stage >= 4 ? 1 : p.done.length / [4, 7, 1, 1][stage];
  const you = s.players.find((x) => x.id === s.you),
    members = you?.teamId
      ? s.players.filter((x) => x.teamId === you.teamId && x.id !== s.you)
      : [],
    pose = celebrating ? "celebrate" : inspecting ? "work" : "idle";
  const avatar = you?.avatar ?? 0,
    accent = ["#68c9be", "#7bbcf1", "#bba4ef", "#f2bf73"][stage];
  return (
    <div
      className={`campus-world world-${stage} ${inspecting ? "is-working" : ""} ${celebrating ? "is-celebrating" : ""}`}
    >
      <svg
        className="campus-backdrop"
        viewBox="0 0 1000 570"
        role="img"
        aria-label={`Laboratorio universitario: ${context[stage].name}; ${Math.round(energy * 100)} % del mecanismo activado`}
      >
        <defs>
          <linearGradient id={`${uid}-wall`} x2="0" y2="1">
            <stop stopColor="#21374d" />
            <stop offset="1" stopColor="#152738" />
          </linearGradient>
          <linearGradient id={`${uid}-floor`} x2="0" y2="1">
            <stop stopColor="#344e5e" />
            <stop offset="1" stopColor="#20384a" />
          </linearGradient>
          <radialGradient id={`${uid}-light`}>
            <stop stopColor={accent} stopOpacity=".45" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <pattern
            id={`${uid}-tiles`}
            width="80"
            height="48"
            patternUnits="userSpaceOnUse"
            patternTransform="skewX(-30)"
          >
            <path
              d="M80 0H0V48"
              fill="none"
              stroke="#87acb0"
              strokeOpacity=".12"
            />
          </pattern>
        </defs>
        <path d="M0 0H1000V350L500 490 0 350Z" fill={`url(#${uid}-wall)`} />
        <path d="M0 350H1000V570H0Z" fill={`url(#${uid}-floor)`} />
        <path d="M0 350H1000V570H0Z" fill={`url(#${uid}-tiles)`} />
        <path d="M0 350H1000" stroke="#6d919f" strokeWidth="5" />
        <g>
          <path d="M0 25H1000v19H0Z" fill="#101e2c" />
          <path d="M48 41h260m385 0h260" stroke="#dce7e6" strokeWidth="7" />
          <path
            d="M352 0v53h290V0"
            fill="#1b3044"
            stroke="#526d7e"
            strokeWidth="2"
          />
          <text
            x="500"
            y="24"
            fill="#a9c9d3"
            fontSize="12"
            letterSpacing="4"
            textAnchor="middle"
          >
            ATLAS RESEARCH FACILITY
          </text>
          <text
            x="500"
            y="44"
            fill={accent}
            fontSize="11"
            letterSpacing="3"
            textAnchor="middle"
          >
            OPTIMIZATION &amp; SYSTEMS LAB
          </text>
        </g>
        <g transform="translate(42 90)">
          <rect
            width="230"
            height="160"
            rx="5"
            fill="#0b1d2c"
            stroke="#61798a"
            strokeWidth="6"
          />
          <rect
            x="8"
            y="8"
            width="214"
            height="144"
            fill="#8db7c1"
            opacity=".13"
          />
          <path
            d="M80 8v144m70-144v144M8 80h214"
            stroke="#4b6c7b"
            strokeWidth="5"
          />
          <path
            d="M8 120l37-46 37 36 30-65 40 54 35-28 35 41v40H8Z"
            fill="#355e63"
          />
          <path d="M8 143l54-34 47 15 57-27 56 38v17H8Z" fill="#456e69" />
          <path
            d="M14 14h202"
            stroke="#e3f5ee"
            strokeOpacity=".25"
            strokeWidth="4"
          />
        </g>
        <g transform="translate(58 270)">
          <path d="M0 20l180-10 18 25-176 12Z" fill="#718e9a" />
          <path d="M18 44v75m160-85v75" stroke="#0f2535" strokeWidth="8" />
          <path d="M28 0v22h52V0" fill="#d5e2df" />
          <g fill="#6ab7a4">
            <rect x="35" y="-24" width="9" height="28" rx="3" />
            <rect x="51" y="-30" width="9" height="34" rx="3" />
            <rect x="67" y="-20" width="9" height="24" rx="3" />
          </g>
          <rect
            x="122"
            y="-38"
            width="47"
            height="51"
            rx="4"
            fill="#243e52"
            stroke="#8faab6"
          />
          <path
            d="M129-28h34m-34 9h22m-22 9h27"
            stroke={accent}
            strokeWidth="2"
          />
        </g>
        <g transform="translate(832 93)">
          <rect
            width="122"
            height="260"
            rx="8"
            fill="#142332"
            stroke="#74909a"
            strokeWidth="6"
          />
          <path
            d="M61 9v244"
            stroke={p.stage >= 4 ? "#9fe8b2" : "#395464"}
            strokeWidth="4"
          />
          <path
            d="M11 10h100v236H11Z"
            fill={p.stage >= 4 ? "#82d0a1" : "#3b5966"}
            opacity=".18"
          />
          <rect
            x="40"
            y="-21"
            width="48"
            height="18"
            rx="3"
            fill={p.stage >= 4 ? "#3d8265" : "#805b3f"}
          />
          <text x="64" y="-8" textAnchor="middle" fill="#e8f4e9" fontSize="9">
            SALIDA
          </text>
          <circle
            cx="105"
            cy="140"
            r="5"
            fill={p.stage >= 4 ? "#76e8ab" : "#efb86a"}
          />
        </g>
        <g transform="translate(703 128)">
          <rect
            width="78"
            height="100"
            rx="5"
            fill="#0d1e2c"
            stroke="#5b7b8d"
            strokeWidth="3"
          />
          <text x="39" y="20" textAnchor="middle" fill="#8caab6" fontSize="9">
            ESTADO
          </text>
          {Array.from({ length: 4 }, (_, i) => (
            <g key={i}>
              <circle
                cx="17"
                cy={37 + i * 15}
                r="3"
                fill={
                  p.stage > i ? "#7cdb9c" : p.stage === i ? accent : "#4a6171"
                }
              />
              <path
                d={`M28 ${37 + i * 15}h30`}
                stroke={p.stage > i ? "#7cdb9c" : "#496577"}
                strokeWidth="3"
              />
            </g>
          ))}
        </g>
        <ellipse
          cx="500"
          cy="330"
          rx="210"
          ry="180"
          fill={`url(#${uid}-light)`}
        />
        {stage === 0 ? (
          <g className="world-device">
            <path
              d="M330 299l223-24 100 46-223 30Z"
              fill="#708c98"
              stroke="#a2b8bb"
              strokeWidth="2"
            />
            <path
              d="M330 300v55l100 48v-52m223-30v53l-223 29v-52"
              fill="#2b4656"
              stroke="#496979"
              strokeWidth="2"
            />
            <path
              d="M361 300l183-15 66 31-180 23Z"
              fill="#102c33"
              stroke={accent}
              strokeWidth="2"
            />
            <g stroke="#6cc8b4" opacity=".65">
              <path d="M394 299l63 30m-24-34 62 29m-23-33 63 29m-23-33 62 29m-185-2 175-20m-151 32 175-20" />
            </g>
            <path
              d="M378 302V165l176-10 39 20v138"
              fill="#82d7d6"
              fillOpacity=".06"
              stroke="#7ad4d3"
              strokeOpacity=".45"
              strokeWidth="2"
            />
            <text
              x="477"
              y="185"
              textAnchor="middle"
              fill="#d2f5eb"
              fontSize="14"
            >
              MODELO DEL RECINTO
            </text>
            <text
              x="477"
              y="207"
              textAnchor="middle"
              fill="#a8d1cf"
              fontSize="12"
            >
              Recurso: {s.problem?.resource} m de cerca
            </text>
            {["VARIABLES", "OBJETIVO", "RESTRICCIÓN", "CONSTANTE"].map(
              (t, i) => (
                <g key={t}>
                  <rect
                    x={400 + (i % 2) * 85}
                    y={224 + Math.floor(i / 2) * 33}
                    width="76"
                    height="24"
                    rx="4"
                    fill={
                      p.done.includes(
                        ["variables", "objective", "constraint", "constant"][i],
                      )
                        ? "#477f6f"
                        : "#213f4d"
                    }
                    stroke={
                      p.done.includes(
                        ["variables", "objective", "constraint", "constant"][i],
                      )
                        ? "#a4f4ce"
                        : "#507887"
                    }
                  />
                  <text
                    x={438 + (i % 2) * 85}
                    y={240 + Math.floor(i / 2) * 33}
                    textAnchor="middle"
                    fill="#d2e9e6"
                    fontSize="8"
                  >
                    {t}
                  </text>
                </g>
              ),
            )}
          </g>
        ) : stage === 1 ? (
          <g className="world-device">
            <path
              d="M344 146l237-16 27 23v181l-237 23-27-25Z"
              fill="#1c3244"
              stroke="#7d9eae"
              strokeWidth="4"
            />
            <path d="M362 157l225-15v177l-225 23Z" fill="#0c2635" />
            <text
              x="470"
              y="180"
              textAnchor="middle"
              fill="#b3dcea"
              fontSize="13"
            >
              CONTROLADOR DEL GRADIENTE
            </text>
            {Array.from({ length: 7 }, (_, i) => (
              <g key={i}>
                <path
                  d={`M384 ${204 + i * 17}h${55 + (i % 3) * 20}v${i % 2 ? 10 : -8}h${65 - (i % 3) * 20}`}
                  fill="none"
                  stroke={
                    p.done.includes(
                      ["fx", "fy", "gx", "gy", "eqx", "eqy", "constraint"][i],
                    )
                      ? accent
                      : "#355564"
                  }
                  strokeWidth="3"
                />
                <circle
                  cx="558"
                  cy={198 + i * 17}
                  r="4"
                  fill={
                    p.done.includes(
                      ["fx", "fy", "gx", "gy", "eqx", "eqy", "constraint"][i],
                    )
                      ? "#a3ecc5"
                      : "#3e5968"
                  }
                />
              </g>
            ))}
            <path d="M390 354v32m171-48v36" stroke="#8aa5ae" strokeWidth="9" />
            <path
              d="M326 399l231-24 67 30-233 26Z"
              fill="#2d5161"
              stroke={accent}
            />
          </g>
        ) : stage === 2 ? (
          <g className="world-device">
            <path
              d="M336 172l216-20 70 29v175l-216 27-70-31Z"
              fill="#274350"
              stroke="#87a9ad"
              strokeWidth="4"
            />
            <path
              d="M354 188l190-16 56 23v142l-193 25-53-24Z"
              fill="#73bca7"
              fillOpacity=".11"
              stroke="#7bc7b6"
              strokeWidth="2"
            />
            <path d="M363 322l174-21 52 24-175 22Z" fill="#395e4c" />
            {Array.from({ length: 9 }, (_, i) => (
              <g
                key={i}
                transform={`translate(${390 + (i % 3) * 56} ${311 + Math.floor(i / 3) * 7 - (i % 3) * 7})`}
              >
                <path
                  d="M0 8v-24m0 13q-20-17-17-22 18 2 17 16m1-6q9-17 20-16-1 15-20 17"
                  fill="#6cae79"
                  stroke="#97c99b"
                  strokeWidth="1.2"
                />
              </g>
            ))}
            <path
              d="M405 175v183m140-203v181"
              stroke="#a3c3c4"
              strokeWidth="3"
            />
            <rect
              x="609"
              y="226"
              width="47"
              height="78"
              rx="5"
              fill="#162e42"
              stroke="#8baab7"
            />
            <text
              x="632"
              y="245"
              textAnchor="middle"
              fill={accent}
              fontSize="11"
            >
              x {draft.x || "?"}
            </text>
            <text
              x="632"
              y="266"
              textAnchor="middle"
              fill={accent}
              fontSize="11"
            >
              y {draft.y || "?"}
            </text>
            <text
              x="632"
              y="287"
              textAnchor="middle"
              fill={accent}
              fontSize="11"
            >
              λ {draft.lambda || "?"}
            </text>
          </g>
        ) : (
          <g className="world-device">
            <path
              d="M372 341l129-30 125 30-125 37Z"
              fill="#68818b"
              stroke="#9ab5b6"
              strokeWidth="3"
            />
            <path d="M372 341v30l129 38 125-38v-30l-125 37Z" fill="#2e4859" />
            <path
              d="M414 313V167m174 146V167"
              stroke="#718c98"
              strokeWidth="13"
            />
            <ellipse
              cx="501"
              cy="162"
              rx="89"
              ry="25"
              fill="#274653"
              stroke="#a0bbba"
              strokeWidth="3"
            />
            <path
              d="M420 168v141q80 38 160 0V168"
              fill="#edc67b"
              fillOpacity=".08"
              stroke="#e7d6a3"
              strokeOpacity=".5"
            />
            <g className="core-orbit" transform="translate(501 240)">
              <ellipse
                rx="70"
                ry="25"
                fill="none"
                stroke={accent}
                strokeWidth="3"
                transform="rotate(-35)"
              />
              <ellipse
                rx="70"
                ry="25"
                fill="none"
                stroke="#90d6da"
                strokeWidth="3"
                transform="rotate(35)"
              />
              <circle r={22 + energy * 14} fill={accent} opacity=".85" />
            </g>
            <text
              x="500"
              y="133"
              textAnchor="middle"
              fill="#ecdbc1"
              fontSize="12"
            >
              {s.problem
                ? `PRESUPUESTO: x² + y² = ${s.problem.resource}`
                : "SISTEMA ENERGÉTICO ESTABILIZADO"}
            </text>
          </g>
        )}
        <path
          className="world-energy-line"
          d="M500 398v37h313v-65h80"
          fill="none"
          stroke={p.stage >= 4 ? "#96ecb7" : accent}
          strokeWidth="4"
          strokeDasharray={p.stage >= 4 ? "0" : "10 9"}
          opacity={0.3 + energy * 0.7}
        />
        <g fill="#91aeb4" opacity=".55" fontSize="9" letterSpacing="2">
          <text x="38" y="548">
            UNIVERSIDAD · INVESTIGACIÓN APLICADA
          </text>
          <text x="763" y="548">
            SECTOR 0{stage + 1} / ATLAS
          </text>
        </g>
      </svg>
      {members.slice(0, 3).map((m, i) => (
        <div key={m.id} className={`world-researcher teammate teammate-${i}`}>
          <Researcher avatar={m.avatar ?? i + 1} label={m.nickname} />
          <span>
            <i className={`online-dot ${m.connected ? "active" : ""}`} />
            {m.nickname}
          </span>
        </div>
      ))}
      <div className={`world-researcher protagonist ${pose}`}>
        <Researcher
          avatar={avatar}
          pose={pose}
          label={`Tu personaje: ${you?.nickname || "Explorador"}`}
        />
        <span>TÚ · {you?.nickname}</span>
      </div>
      <div className="world-location">
        <span>ATLAS</span>
        <strong>{context[stage].name}</strong>
        <small>
          {members.length
            ? `${members.length + 1} investigadores en tu equipo`
            : "Investigación individual"}
        </small>
      </div>
      {celebrating && (
        <div className="world-activation" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ "--spark": i } as React.CSSProperties} />
          ))}
        </div>
      )}
    </div>
  );
}
