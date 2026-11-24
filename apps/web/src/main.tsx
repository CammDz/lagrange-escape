import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  Atom,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronRight,
  Clock,
  DoorOpen,
  Download,
  Expand,
  FlaskConical,
  Lightbulb,
  LockKeyhole,
  LogOut,
  Pause,
  Play,
  Plus,
  Radio,
  Settings,
  ShieldCheck,
  SkipForward,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type {
  Snapshot,
  Config,
  Problem,
  Progress,
  Entry,
  Action,
} from "../../../packages/shared";
import "./style.css";
import { PairBoard } from "./pair-board";
import { Researcher, MissionBriefing } from "./campus-world";
import {
  MissionScene,
  TeamCompanion,
  VaultPreview,
  MathKeypad,
  draftNumber,
} from "./experience";
const titles = [
  "Reactor de restricciones",
  "Circuito del gradiente",
  "Bóveda de optimización",
  "Núcleo final",
];
const subtitles = [
  "Modela el problema. Enciende el reactor.",
  "Conecta las derivadas. Restaura la energía.",
  "Resuelve el sistema. Abre la bóveda.",
  "Encuentra el máximo. Libera el núcleo.",
];
const defaults: Config = {
  title: "Misión de cálculo",
  duration: 10,
  maxPlayers: 30,
  mode: "individual",
  teamSize: 30,
  allowTeams: true,
  hints: true,
  sound: true,
  ranking: true,
};
async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const r = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await r.json()) as { error?: string };
  if (!r.ok) throw Error(data.error || "No fue posible conectar.");
  return data as T;
}
const time = (ms: number) =>
  `${Math.floor(Math.max(0, ms) / 60000)
    .toString()
    .padStart(2, "0")}:${Math.floor((Math.max(0, ms) % 60000) / 1000)
    .toString()
    .padStart(2, "0")}`;
function Formula({ tex }: { tex: string }) {
  return (
    <span
      className="formula"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(tex, {
          throwOnError: false,
          trust: false,
          output: "html",
        }),
      }}
    />
  );
}
function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const f = () => setPath(location.pathname);
    addEventListener("popstate", f);
    return () => removeEventListener("popstate", f);
  }, []);
  return [
    path,
    (p: string) => {
      history.pushState({}, "", p);
      setPath(p);
    },
  ] as const;
}
function useRoom(code: string, view = "player") {
  const [snap, setSnap] = useState<Snapshot>();
  const [online, setOnline] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const ws = useRef<WebSocket | null>(null),
    next = useRef(1),
    ref = useRef<Snapshot | undefined>(undefined);
  useEffect(() => {
    let stopped = false,
      timer: ReturnType<typeof setTimeout>,
      attempt = 0;
    let lastMessage = performance.now();
    const heartbeat = setInterval(() => {
      const socket = ws.current;
      if (socket?.readyState !== WebSocket.OPEN) return;
      if (performance.now() - lastMessage > 35000) {
        socket.close();
        return;
      }
      socket.send(
        JSON.stringify({
          v: 1,
          id: crypto.randomUUID(),
          seq: next.current,
          type: "snapshot",
        }),
      );
    }, 15000);
    setSnap(undefined);
    setBlocked(false);
    ref.current = undefined;
    const connect = () => {
      if (stopped) return;
      const socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/rooms/${code}/ws?view=${view}`,
      );
      ws.current = socket;
      socket.onopen = () => {
        lastMessage = performance.now();
        attempt = 0;
        setOnline(true);
        setError("");
      };
      socket.onmessage = (e) => {
        lastMessage = performance.now();
        const msg = JSON.parse(e.data);
        if (msg.type === "error") {
          setError(msg.message);
          setBusy(false);
          if (msg.nextSeq) next.current = msg.nextSeq;
          return;
        }
        if (msg.type === "snapshot" || msg.type === "patch") {
          const s: Snapshot =
            msg.type === "snapshot"
              ? msg.data
              : { ...ref.current, ...msg.data };
          if (s.v !== 1) {
            setError("Actualiza la página para usar esta versión.");
            socket.close();
            return;
          }
          if (ref.current && s.seq < ref.current.seq) return;
          ref.current = s;
          next.current = s.nextSeq || 1;
          setSnap(s);
          setBusy(false);
        }
      };
      socket.onclose = (e) => {
        setOnline(false);
        setBusy(false);
        if (stopped) return;
        if ([4001, 4002, 4003].includes(e.code)) {
          setBlocked(true);
          setError(e.reason || "Sesión terminada.");
          return;
        }
        timer = setTimeout(
          connect,
          Math.min(15000, 600 * 2 ** attempt++) + Math.random() * 400,
        );
      };
      socket.onerror = () =>
        setError("Conexión interrumpida. Intentando reconectar…");
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(heartbeat);
      ws.current?.close();
    };
  }, [code, view]);
  const send = useCallback(
    (type: Action["type"], data?: Record<string, string>) => {
      if (ws.current?.readyState !== WebSocket.OPEN) return;
      setBusy(true);
      setError("");
      ws.current.send(
        JSON.stringify({
          v: 1,
          id: crypto.randomUUID(),
          seq: next.current++,
          type,
          stage:
            type === "answer" || type === "hint"
              ? ref.current?.progress?.stage
              : undefined,
          data,
        }),
      );
    },
    [],
  );
  return { snap, online, error, blocked, busy, send };
}
function useTimer(s?: Snapshot) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!s) return;
    const received = performance.now();
    const tick = () =>
      setValue(
        s.status === "running"
          ? Math.max(0, s.remaining - (performance.now() - received))
          : s.status === "countdown"
            ? Math.max(
                0,
                s.deadline - s.serverNow - (performance.now() - received),
              )
            : s.remaining,
      );
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [s]);
  return value;
}
function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "small" : ""}`}>
      <span className="brandmark">
        <Atom aria-hidden="true" />
      </span>
      <span>
        LAGRANGE<span className="escape">ESCAPE</span>
      </span>
    </div>
  );
}
function ErrorBox({ text }: { text: string }) {
  return text ? (
    <p className="error" role="alert">
      {text}
    </p>
  ) : null;
}
function Lab({
  stage = 0,
  energy = 0,
  hero = false,
}: {
  stage?: number;
  energy?: number;
  hero?: boolean;
}) {
  return (
    <svg
      className={`lab stage-${stage} ${hero ? "hero-lab" : ""}`}
      viewBox="0 0 800 480"
      role="img"
      aria-label={`Laboratorio, energía ${Math.round(energy * 100)} por ciento`}
    >
      <defs>
        <linearGradient id="floor" x2="0" y2="1">
          <stop stopColor="#101f36" />
          <stop offset="1" stopColor="#080f20" />
        </linearGradient>
        <radialGradient id="glow">
          <stop
            stopColor={stage === 3 ? "#a78bfa" : "#22d3ee"}
            stopOpacity=".4"
          />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="door">
          <stop stopColor="#173a57" />
          <stop offset="1" stopColor="#12243b" />
        </linearGradient>
      </defs>
      <path d="M0 0H800V340L400 480 0 340Z" fill="#0a1427" />
      <path d="M0 340L400 210 800 340 400 480Z" fill="url(#floor)" />
      <g stroke="#1c354d" strokeWidth="1">
        {Array.from({ length: 9 }, (_, i) => (
          <React.Fragment key={i}>
            <path d={`M${i * 100 - 400} 340l400 140 400-140`} fill="none" />
            <path d={`M${i * 100} 340l400-130`} fill="none" />
          </React.Fragment>
        ))}
      </g>
      <path
        d="M0 52L400 185 800 52M400 185V210M0 340V52M800 340V52"
        stroke="#233c56"
        fill="none"
        strokeWidth="3"
      />
      <g stroke="#22d3ee" strokeWidth="3" opacity=".65">
        <path d="M45 85l110 37m490 0 110-37M50 305l150-49m400 0 150 49" />
      </g>
      <ellipse cx="400" cy="300" rx="240" ry="150" fill="url(#glow)" />
      <g className="door">
        <path
          d="M570 140l105-35v165l-105 36z"
          fill="url(#door)"
          stroke="#274a69"
          strokeWidth="5"
        />
        <path
          d="M621 125v162"
          stroke={energy >= 1 ? "#22c55e" : "#22d3ee"}
          strokeWidth="3"
        />
        <path d="M587 164l70-23M587 179l70-23" stroke="#3b5877" />
        <circle
          cx="652"
          cy="229"
          r="5"
          fill={energy >= 1 ? "#22c55e" : "#fbbf24"}
        />
      </g>
      <g transform="translate(105 175)">
        <path
          d="M0 0l100 33v75L0 75Z"
          fill="#152c45"
          stroke="#33506b"
          strokeWidth="3"
        />
        <path d="M12 15l73 24v42L12 57Z" fill="#071322" stroke="#22d3ee" />
        <path
          className="scan"
          d="M20 29l58 19m-58-6 40 13"
          stroke="#22d3ee"
          strokeWidth="3"
        />
        <path d="M-15 90l110 36 25-9-110-36Z" fill="#27445e" />
      </g>
      <g className="reactor">
        <ellipse
          cx="400"
          cy="359"
          rx="105"
          ry="36"
          fill="#071321"
          stroke="#2c5271"
          strokeWidth="4"
        />
        <path
          d="M300 325v30q100 65 200 0v-30"
          fill="#193449"
          stroke="#33516a"
          strokeWidth="3"
        />
        <ellipse
          cx="400"
          cy="326"
          rx="100"
          ry="32"
          fill="#102b43"
          stroke="#22d3ee"
          strokeWidth="3"
        />
        <ellipse
          cx="400"
          cy="322"
          rx="72"
          ry="21"
          fill="#22d3ee"
          opacity=".15"
        />
        {stage === 1 ? (
          <g>
            <path
              d="M320 217l80-25 80 25v88l-80 25-80-25Z"
              fill="#112d43"
              stroke="#22d3ee"
              strokeWidth="3"
            />
            <g stroke="#3d7692" strokeWidth="3" fill="none">
              <path d="M337 240h35v-25m-35 44h60v48m-60-30h108v-45m-47 14h52m-10 43h-28v23" />
            </g>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <circle
                key={i}
                cx={340 + (i % 3) * 42}
                cy={232 + Math.floor(i / 3) * 29}
                r="7"
                fill={energy > i / 7 ? "#22d3ee" : "#23435b"}
                stroke="#51829c"
              />
            ))}
            <path
              d="M295 345l-40 20 125 40 40-20Z"
              fill="#143a4c"
              stroke={energy >= 1 ? "#22c55e" : "#2c5d74"}
              strokeWidth="3"
            />
          </g>
        ) : stage === 3 ? (
          <g className="core-orbit" transform="translate(400 253)">
            <circle r="64" fill="#281c4c" stroke="#8b5cf6" strokeWidth="3" />
            <ellipse
              rx="64"
              ry="23"
              fill="none"
              stroke="#a78bfa"
              strokeWidth="2"
            />
            <ellipse
              rx="23"
              ry="64"
              fill="none"
              stroke="#a78bfa"
              strokeWidth="2"
            />
            <ellipse
              rx="84"
              ry="31"
              transform="rotate(-30)"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="3"
            />
            <circle r={18 + energy * 16} fill="#c4b5fd" opacity=".9" />
            <path
              d="M-100 0h26m148 0h26M0-90v20M0 70v20"
              stroke="#a78bfa"
              strokeWidth="4"
            />
          </g>
        ) : stage === 2 ? (
          <g>
            <path
              d="M344 220l56-20 56 20v87l-56 20-56-20Z"
              fill="#253d61"
              stroke="#a78bfa"
              strokeWidth="3"
            />
            <circle
              cx="400"
              cy="265"
              r="22"
              fill="#0b1020"
              stroke="#22d3ee"
              strokeWidth="3"
            />
            <path d="M390 265h20m-10-10v20" stroke="#22d3ee" />
          </g>
        ) : (
          <>
            <path
              d="M355 205v106m90-106v106"
              stroke="#2c5774"
              strokeWidth="12"
            />
            <ellipse
              cx="400"
              cy="200"
              rx="58"
              ry="20"
              fill="#132f48"
              stroke="#51718c"
              strokeWidth="3"
            />
            <ellipse
              cx="400"
              cy="202"
              rx="39"
              ry="13"
              fill="#22d3ee"
              opacity=".5"
            />
            <path
              d="M365 205v106q35 16 70 0V205"
              fill={stage === 3 ? "#8b5cf6" : "#22d3ee"}
              opacity={0.15 + energy * 0.5}
            />
            <g className="core-orbit" transform="translate(400 260)">
              <ellipse
                rx="51"
                ry="19"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="3"
                transform="rotate(-35)"
              />
              <ellipse
                rx="51"
                ry="19"
                fill="none"
                stroke="#a78bfa"
                strokeWidth="3"
                transform="rotate(35)"
              />
              <circle
                r={12 + energy * 8}
                fill={stage === 3 ? "#c4b5fd" : "#67e8f9"}
              />
            </g>
          </>
        )}
      </g>
      <g fill="#294660">
        <path d="M270 370l16-5 12 6-16 5Z" />
        <path d="M520 370l16-5 12 6-16 5Z" />
      </g>
      <g
        className="lab-text"
        fill="#4c7897"
        fontSize="11"
        fontFamily="monospace"
      >
        <text x="36" y="42">
          SECTOR 0{stage + 1} / LAGRANGE LAB
        </text>
        <text x="601" y="339">
          ENERGY {Math.round(energy * 100)}%
        </text>
      </g>
      <path
        d="M250 363l-55 18m350-18 55 18"
        stroke={energy >= 1 ? "#22c55e" : "#22d3ee"}
        strokeWidth="4"
        className="pulse"
      />
    </svg>
  );
}
function Home({ go }: { go: (p: string) => void }) {
  const [code, setCode] = useState(
    new URLSearchParams(location.search).get("codigo") || "",
  );
  const [nickname, setNickname] = useState("");
  const [room, setRoom] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const invite = new URLSearchParams(location.search).get("codigo");
    if (!invite || !/^[A-HJ-NP-Z2-9]{6}$/.test(invite)) return;
    setBusy(true);
    api<Snapshot>("/rooms/" + invite + "/snapshot")
      .then(setRoom)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const c = code.trim().toUpperCase();
      if (!room) {
        const s = await api("/rooms/" + c + "/snapshot");
        setRoom(s);
        return;
      }
      await api("/rooms/" + c + "/join", {
        nickname,
      });
      go("/jugar/" + c);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="landing">
      <header className="topbar">
        <Brand />
        <button className="ghost" onClick={() => go("/admin")}>
          <ShieldCheck size={17} /> Administración
        </button>
      </header>
      <main className="hero">
        <section className="hero-copy">
          <span className="eyebrow">
            <span /> MISIÓN MULTIJUGADOR · CÁLCULO MULTIVARIABLE
          </span>
          <h1>
            El conocimiento
            <br />
            es tu <em>salida.</em>
          </h1>
          <p className="lead">
            Un laboratorio bloqueado. Cuatro cámaras.
            <br />
            Diez minutos para investigar, justificar y escapar.
          </p>
          <p className="hero-desc">
            Entra al laboratorio universitario Atlas. Diseña un recinto
            experimental, reconstruye su controlador y estabiliza la energía
            aplicando multiplicadores de Lagrange. Tu personaje y tu grupo
            llevan la investigación.
          </p>
          <div className="hero-stats">
            <span>
              <Clock />
              15 min<span>de investigación</span>
            </span>
            <span>
              <DoorOpen />4 cámaras<span>una sola misión</span>
            </span>
            <span>
              <Users />
              Hasta 30<span>exploradores por sala</span>
            </span>
          </div>
          <form className="join-card" onSubmit={submit}>
            <div className="join-heading">
              <Zap />
              <h2>{room ? "Prepara tu ingreso" : "Tu misión comienza aquí"}</h2>
              <span>EN LÍNEA</span>
            </div>
            {!room ? (
              <>
                <label htmlFor="code">Código de la partida</label>
                <div className="join-row">
                  <input
                    id="code"
                    className="code-input"
                    placeholder="ABC234"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    minLength={6}
                    maxLength={6}
                    autoComplete="off"
                    required
                  />
                  <button className="primary" disabled={busy}>
                    Unirse a partida <ChevronRight size={18} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  {room.config.title} · {room.players.length}/
                  {room.config.maxPlayers} exploradores
                </p>
                <label>
                  Tu apodo
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    minLength={2}
                    maxLength={28}
                    required
                    autoComplete="nickname"
                  />
                </label>
                <p className="muted">
                  Usa tu apodo o el de tu grupo. Si juegan juntos, entren desde
                  un solo dispositivo.
                </p>
                <div className="row">
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => setRoom(undefined)}
                  >
                    Volver
                  </button>
                  <button className="primary" disabled={busy}>
                    Entrar al laboratorio
                  </button>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => go("/jugar/" + code)}
                  >
                    Recuperar sesión
                  </button>
                </div>
              </>
            )}
            <ErrorBox text={error} />
            <small>
              <LockKeyhole size={13} /> Sin registro. Sin correo. Solo tu
              curiosidad.
            </small>
          </form>
        </section>
        <section className="hero-art">
          <div className="art-caption">
            <span className="tag">LAGRANGE RESEARCH FACILITY</span>
            <span className="mono">EST. 2084</span>
          </div>
          <Lab hero energy={0.45} />
          <div className="hero-researchers" aria-hidden="true">
            <Researcher avatar={2} pose="work" />
            <Researcher avatar={0} />
          </div>
          <div className="art-equation">
            <span>LA CLAVE DEL ESCAPE</span>
            <Formula tex="\nabla f = \lambda\nabla g" />
            <span className="cyan">SISTEMAS EN ESPERA</span>
          </div>
          <div className="art-footer">
            <Radio size={16} />
            <span>Reactor estable. Esperando exploradores.</span>
          </div>
        </section>
      </main>
      <section className="mission-strip">
        <div className="strip-label">
          <span>EL RECORRIDO</span>
          <strong>
            Cuatro desafíos.
            <br />
            Una nueva forma de aprender.
          </strong>
        </div>
        {titles.map((t, i) => (
          <div className="mission-step" key={t}>
            <span className="step-number">0{i + 1}</span>
            <span>
              {t}
              <small>
                {
                  [
                    "Identifica y modela",
                    "Conecta y deriva",
                    "Resuelve y desbloquea",
                    "Optimiza y escapa",
                  ][i]
                }
              </small>
            </span>
          </div>
        ))}
      </section>
      <footer className="landing-footer">
        <span>Diseñado para explorar. Construido para aprender.</span>
        <span>
          MATEMÁTICAS QUE ABREN PUERTAS <Atom size={14} />
        </span>
      </footer>
    </div>
  );
}
function ConfigForm({
  config,
  onSave,
  label = "Crear partida",
}: {
  config: Config;
  onSave: (c: Config) => Promise<void>;
  label?: string;
}) {
  const [c, setC] = useState({ ...config, duration: 10 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="config-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave({ ...c, mode: "individual", teamSize: 30 });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Nombre de la partida
        <input
          value={c.title}
          minLength={2}
          maxLength={28}
          required
          onChange={(e) => setC({ ...c, title: e.target.value })}
        />
      </label>
      <div className="grid-2">
        <label>
          Duración fija
          <input
            value="10 minutos"
            readOnly
            aria-label="Duración de la partida"
          />
        </label>
        <label>
          Máximo de participantes
          <input
            type="number"
            min="1"
            max="30"
            value={c.maxPlayers}
            onChange={(e) => setC({ ...c, maxPlayers: +e.target.value })}
          />
        </label>
      </div>
      {(["hints", "sound", "ranking"] as const).map((k, i) => (
        <label className="check-label" key={k}>
          <input
            type="checkbox"
            checked={c[k]}
            onChange={(e) => setC({ ...c, [k]: e.target.checked })}
          />
          {
            [
              "Permitir pistas",
              "Permitir sonidos",
              "Clasificación pública en vivo",
            ][i]
          }
        </label>
      ))}
      <ErrorBox text={error} />
      <button className="primary" disabled={busy}>
        <Plus size={18} />
        {label}
      </button>
    </form>
  );
}
function Admin({ go }: { go: (p: string) => void }) {
  const [auth, setAuth] = useState(false),
    [loading, setLoading] = useState(true),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [rooms, setRooms] = useState<Snapshot[]>([]),
    [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState("");
  const refresh = useCallback(async () => {
    try {
      setRooms(await api("/rooms"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    api("/session")
      .then(() => setAuth(true))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!auth) return;
    refresh();
    const i = setInterval(refresh, 10000);
    return () => clearInterval(i);
  }, [auth, refresh]);
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={() => go("/")}>
          <Brand small />
        </button>
        <div className="row">
          <span className="tag">
            <ShieldCheck size={14} /> CENTRO DE CONTROL
          </span>
          {auth && (
            <button
              className="ghost"
              onClick={async () => {
                await api("/logout", {});
                setAuth(false);
                setSelected("");
              }}
            >
              <LogOut size={17} /> Salir
            </button>
          )}
        </div>
      </header>
      {loading ? (
        <p>Cargando sesión…</p>
      ) : !auth ? (
        <main className="login panel">
          <ShieldCheck size={32} className="cyan" />
          <h1>Acceso al laboratorio</h1>
          <p>Área reservada para docentes y administradores.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/login", { password });
                setPassword("");
                setError("");
                setAuth(true);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                required
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <ErrorBox text={error} />
            <button className="primary">Iniciar sesión</button>
          </form>
        </main>
      ) : selected ? (
        <AdminRoom
          code={selected}
          onBack={() => {
            setSelected("");
            refresh();
          }}
        />
      ) : (
        <main className="dashboard">
          <div className="section-heading">
            <div>
              <span className="eyebrow">OPERACIONES DEL LABORATORIO</span>
              <h1>Tus misiones</h1>
              <p>Prepara una experiencia. Acompaña cada descubrimiento.</p>
            </div>
            <button className="primary" onClick={() => setCreating(!creating)}>
              <Plus size={18} /> Nueva partida
            </button>
          </div>
          <div className="stat-grid">
            <div className="panel">
              <FlaskConical />
              <strong>{rooms.length}</strong>
              <span>Partidas conservadas</span>
            </div>
            <div className="panel">
              <Radio />
              <strong>
                {
                  rooms.filter(
                    (r) => !["waiting", "finished"].includes(r.status),
                  ).length
                }
              </strong>
              <span>En curso</span>
            </div>
            <div className="panel">
              <Users />
              <strong>
                {rooms.reduce(
                  (n, r) => n + r.players.filter((p) => p.connected).length,
                  0,
                )}
              </strong>
              <span>Exploradores conectados</span>
            </div>
          </div>
          <ErrorBox text={error} />
          {creating && (
            <section className="panel narrow">
              <h2>Configurar misión</h2>
              <ConfigForm
                config={defaults}
                onSave={async (c) => {
                  const r = await api("/rooms", c);
                  setCreating(false);
                  setSelected(r.code);
                }}
              />
            </section>
          )}
          <h2>Partidas e historial · últimos 30 días</h2>
          <div className="room-grid">
            {rooms.map((r) => (
              <button
                className="panel room-card"
                key={r.code}
                onClick={() => setSelected(r.code)}
              >
                <div className="row between">
                  <span className="tag">{statusLabel(r.status)}</span>
                  <ArrowUpRight size={18} />
                </div>
                <h3>{r.config.title}</h3>
                <span className="room-code">{r.code}</span>
                <div className="row">
                  <span>
                    <Users size={15} /> {r.players.length}
                  </span>
                  <span>
                    <Clock size={15} /> {r.config.duration} min
                  </span>
                </div>
              </button>
            ))}
          </div>
          {rooms.length === 0 && (
            <div className="empty">
              <FlaskConical size={40} />
              <p>
                Aún no hay misiones. Crea la primera partida para recibir a tus
                estudiantes.
              </p>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
const statusLabel = (s: string) =>
  ({
    waiting: "Sala de espera",
    countdown: "Preparando inicio",
    running: "Misión en curso",
    paused: "Pausa global",
    finished: "Misión finalizada",
  })[s] || s;
function Connection({ online }: { online: boolean }) {
  return (
    <span className={`connection ${online ? "" : "offline"}`}>
      {online ? <Wifi size={15} /> : <WifiOff size={15} />}{" "}
      {online ? "Conectado" : "Reconectando"}
    </span>
  );
}
function AdminRoom({ code, onBack }: { code: string; onBack: () => void }) {
  const { snap: s, online, error } = useRoom(code, "admin"),
    ms = useTimer(s);
  const [err, setErr] = useState(""),
    [settings, setSettings] = useState(false),
    [inviteLink, setInviteLink] = useState(""),
    [copied, setCopied] = useState(false);
  const run = async (path: string, b: unknown) => {
    setErr("");
    try {
      await api(`/rooms/${code}/${path}`, b);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  if (!s)
    return (
      <main className="dashboard">
        <button className="ghost" onClick={onBack}>
          Volver a partidas
        </button>
        <p>Conectando con la sala…</p>
        <ErrorBox text={error} />
      </main>
    );
  return (
    <main className="dashboard">
      <div className="section-heading">
        <div>
          <button className="text-button" onClick={onBack}>
            Todas las partidas
          </button>
          <h1>{s.config.title}</h1>
          <Connection online={online} />
        </div>
        <div className="room-code">{code}</div>
      </div>
      <ErrorBox text={error || err} />
      <div className="monitor-layout">
        <section>
          <div className="panel control-panel">
            <div>
              <span className="eyebrow">{statusLabel(s.status)}</span>
              <strong className="big-timer">{time(ms)}</strong>
            </div>
            <div className="control-buttons">
              {s.status === "waiting" && (
                <>
                  <button
                    className="primary"
                    disabled={!online}
                    onClick={() => run("control", { command: "start" })}
                  >
                    <Play size={18} /> Iniciar partida
                  </button>
                  <button
                    className="secondary"
                    onClick={() => run("control", { command: "toggle" })}
                  >
                    {s.open ? "Cerrar ingreso" : "Reabrir ingreso"}
                  </button>
                  <button
                    className="ghost"
                    onClick={() => setSettings(!settings)}
                  >
                    <Settings size={18} /> Configuración
                  </button>
                </>
              )}
              {s.status === "running" && (
                <button
                  className="primary"
                  onClick={() => run("control", { command: "pause" })}
                >
                  <Pause size={18} /> Pausar
                </button>
              )}
              {s.status === "paused" && (
                <button
                  className="primary"
                  onClick={() => run("control", { command: "resume" })}
                >
                  <Play size={18} /> Reanudar
                </button>
              )}
              {["running", "paused", "countdown"].includes(s.status) && (
                <button
                  className="secondary"
                  onClick={() => run("control", { command: "finish" })}
                >
                  <SkipForward size={18} /> Finalizar ahora
                </button>
              )}
              <a
                className="ghost button"
                href={"/presentacion/" + code}
                target="_blank"
                rel="noreferrer"
              >
                <Expand size={17} /> Proyección
              </a>
              <a className="ghost button" href={`/api/rooms/${code}/export`}>
                <Download size={17} /> Descargar CSV
              </a>
            </div>
          </div>
          {settings && s.status === "waiting" && (
            <div className="panel">
              <h2>Ajustes de la sala</h2>
              <ConfigForm
                config={s.config}
                label="Guardar configuración"
                onSave={async (c) => {
                  await api(`/rooms/${code}/config`, c);
                  setSettings(false);
                }}
              />
            </div>
          )}
          <div className="panel">
            <h2>
              Exploradores{" "}
              <span className="muted">
                {s.players.length}/{s.config.maxPlayers}
              </span>
            </h2>
            <div className="participant-list">
              {s.players.map((p) => (
                <div className="participant" key={p.id}>
                  <span className={`avatar ${p.connected ? "active" : ""}`}>
                    {p.nickname.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong>{p.nickname}</strong>
                    <small>
                      {p.connected ? "En línea" : "Desconectado"} ·{" "}
                      {p.ready ? "Preparado" : "Sin preparar"}
                      <br />
                      Última actividad:{" "}
                      {new Date(p.lastSeen).toLocaleTimeString("es-CO")}
                    </small>
                  </div>
                  {s.status === "waiting" && (
                    <button
                      className="icon-button"
                      aria-label={"Expulsar a " + p.nickname}
                      onClick={() => run("kick", { id: p.id })}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <Leaderboard s={s} />
        </section>
        <aside>
          <div className="panel invite">
            <QRCodeSVG
              value={`${location.origin}/?codigo=${code}`}
              size={160}
              marginSize={2}
            />
            <h3>Invita a tus estudiantes</h3>
            <strong className="room-code">{code}</strong>
            <button
              className="primary"
              onClick={() => {
                setInviteLink(`${location.origin}/?codigo=${code}`);
                setCopied(false);
              }}
            >
              Generar enlace de ingreso
            </button>
            {inviteLink && (
              <div className="invite-link">
                <label>
                  Enlace para estudiantes
                  <input
                    readOnly
                    value={inviteLink}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <div className="row">
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteLink);
                        setCopied(true);
                      } catch {
                        setErr("Selecciona y copia el enlace del campo.");
                      }
                    }}
                  >
                    {copied ? "Enlace copiado" : "Copiar enlace"}
                  </button>
                  <a
                    className="ghost button"
                    href={inviteLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir ingreso
                  </a>
                </div>
                <small aria-live="polite">
                  El enlace abre directamente esta sala. Cada estudiante escribe
                  su apodo.
                </small>
              </div>
            )}
            <p>
              {s.open ? "Ingreso abierto" : "Ingreso cerrado"} · Un apodo por
              persona o grupo
            </p>
          </div>
          <div className="panel">
            <h3>Reglas de la misión</h3>
            <p>
              Inicio simultáneo con 3 segundos de preparación. La pausa congela
              el tiempo de todos.
            </p>
            <p>
              Cada apodo tiene su propio avance y puntuación. Puede representar
              a una persona o a un grupo que juega desde un mismo dispositivo.
            </p>
          </div>
          <button
            className="ghost danger"
            onClick={async () => {
              await api(`/rooms/${code}/delete`, {});
              onBack();
            }}
          >
            Eliminar sala y resultados
          </button>
        </aside>
      </div>
    </main>
  );
}
function Leaderboard({ s, final = false }: { s: Snapshot; final?: boolean }) {
  return (
    <section className={`panel leaderboard ${final ? "final-board" : ""}`}>
      <div className="row between">
        <h2>{final ? "Resultados oficiales" : "Clasificación en vivo"}</h2>
        <Trophy className="gold" size={22} />
      </div>
      {(["individual", "team"] as const).map((category) => {
        const rows = s.leaderboard.filter((r) => r.category === category);
        if (!rows.length) return null;
        return (
          <div key={category}>
            <h3 className="category">
              {category === "team"
                ? "Grupos de partidas anteriores"
                : "Participantes"}
            </h3>
            {final && (
              <div className="podium">
                {rows
                  .filter((r) => r.rank <= 3)
                  .map((r, i) => (
                    <div
                      key={r.id}
                      className={`podium-place place-${r.rank}`}
                      style={{ animationDelay: i * 0.15 + "s" }}
                    >
                      <Trophy size={r.rank === 1 ? 34 : 25} />
                      <span>#{r.rank}</span>
                      <strong>{r.name}</strong>
                      <b>
                        {r.score} <small>pts</small>
                      </b>
                    </div>
                  ))}
              </div>
            )}
            {rows.map((r) => (
              <div className="ranking-row" key={r.id}>
                <b className={r.rank === 1 ? "gold" : ""}>
                  {r.rank.toString().padStart(2, "0")}
                </b>
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {r.stage}/4 cámaras · {r.steps} aciertos · {r.errors}{" "}
                    errores · {r.hints} pistas · {time(r.lastTime)}
                  </small>
                  <div className="mini-progress">
                    <span style={{ width: (r.stage * 100) / 4 + "%" }} />
                  </div>
                </div>
                <strong>
                  {r.score}
                  <small> pts</small>
                </strong>
                <span
                  aria-label={r.connected ? "Conectado" : "Desconectado"}
                  className={`online-dot ${r.connected ? "active" : ""}`}
                />
              </div>
            ))}
          </div>
        );
      })}
      {s.leaderboard.length === 0 && (
        <p className="muted">
          {s.config.ranking
            ? "El marcador aparecerá cuando ingresen exploradores."
            : "El docente ha reservado la clasificación para el final."}
        </p>
      )}
    </section>
  );
}
function ExportImage({ rows }: { rows: Entry[] }) {
  return (
    <button
      className="secondary"
      onClick={() => {
        const canvas = document.createElement("canvas");
        canvas.width = 1000;
        canvas.height = 180 + rows.length * 56;
        const c = canvas.getContext("2d")!;
        c.fillStyle = "#0b1020";
        c.fillRect(0, 0, canvas.width, canvas.height);
        c.font = "bold 32px sans-serif";
        c.fillStyle = "#22d3ee";
        c.fillText("LAGRANGE ESCAPE · Resultados", 35, 60);
        c.font = "20px sans-serif";
        rows.forEach((r, i) => {
          c.fillStyle = r.rank === 1 ? "#fbbf24" : "#edf4ff";
          c.fillText(
            `${r.category === "team" ? "Equipo" : "Individual"} #${r.rank} · ${r.name} · ${r.score} pts · ${r.stage}/4`,
            35,
            120 + i * 56,
          );
        });
        const a = document.createElement("a");
        a.download = "lagrange-resultados.png";
        a.href = canvas.toDataURL("image/png");
        a.click();
      }}
    >
      <Download size={17} /> Guardar imagen
    </button>
  );
}
function Presentation({ code }: { code: string }) {
  const { snap: s, online, error } = useRoom(code, "public"),
    ms = useTimer(s);
  return (
    <div className="projection">
      <header className="topbar">
        <Brand />
        <button
          className="ghost"
          onClick={() =>
            document.documentElement.requestFullscreen().catch(() => {})
          }
        >
          <Expand /> Pantalla completa
        </button>
      </header>
      <ErrorBox text={error} />
      {s ? (
        <main>
          <span className="eyebrow">{statusLabel(s.status)}</span>
          <h1>{s.config.title}</h1>
          {s.status === "waiting" ? (
            <div className="projection-invite">
              <QRCodeSVG
                value={`${location.origin}/?codigo=${code}`}
                size={220}
                marginSize={3}
              />
              <div>
                <p>Únete a la misión</p>
                <strong className="projection-code">{code}</strong>
                <p>
                  {s.players.length} exploradores · {s.config.duration} minutos
                </p>
              </div>
            </div>
          ) : (
            <div className="projection-timer">
              {s.status === "finished"
                ? "MISIÓN FINALIZADA"
                : s.status === "countdown"
                  ? Math.ceil(ms / 1000)
                  : time(ms)}
            </div>
          )}
          <Connection online={online} />
          <Leaderboard s={s} final={s.status === "finished"} />
          {s.status === "finished" && <ExportImage rows={s.leaderboard} />}
        </main>
      ) : (
        <p>Conectando proyección…</p>
      )}
    </div>
  );
}
function SoundButton({
  enabled,
  setEnabled,
}: {
  enabled: boolean;
  setEnabled: (b: boolean) => void;
}) {
  return (
    <button
      className="icon-button"
      aria-label={enabled ? "Desactivar sonido" : "Activar sonido"}
      aria-pressed={enabled}
      onClick={() => setEnabled(!enabled)}
    >
      {enabled ? <Volume2 /> : <VolumeX />}
    </button>
  );
}
function beep() {
  try {
    const c = new AudioContext(),
      o = c.createOscillator(),
      g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(440, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(880, c.currentTime + 0.15);
    g.gain.setValueAtTime(0.05, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.3);
    o.onended = () => c.close();
  } catch {
    /* audio unavailable */
  }
}
function Game({ code, go }: { code: string; go: (p: string) => void }) {
  const { snap: s, online, error, blocked, busy, send } = useRoom(code),
    ms = useTimer(s);
  const [sound, setSound] = useState(false),
    [reduced, setReduced] = useState(
      matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [notes, setNotes] = useState(false),
    [mobileView, setMobileView] = useState<"lab" | "console">("lab"),
    [worldDraft, setWorldDraft] = useState<Record<string, string>>({}),
    [showDetails, setShowDetails] = useState(false);
  const previous = useRef(0);
  useEffect(() => setMobileView("lab"), [s?.progress?.stage]);
  useEffect(() => {
    if (
      s?.progress &&
      s.progress.correct > previous.current &&
      sound &&
      s.config.sound
    )
      beep();
    previous.current = s?.progress?.correct || 0;
  }, [s, sound]);
  if (!s)
    return (
      <div className="app-shell">
        <Brand />
        <p>Conectando con el laboratorio…</p>
        <ErrorBox text={error} />
        <button className="secondary" onClick={() => go("/?codigo=" + code)}>
          Volver al ingreso
        </button>
      </div>
    );
  const p = s.progress,
    stage = p?.stage || 0,
    you = s.players.find((p) => p.id === s.you),
    team = s.teams.find((t) => t.id === you?.teamId);
  if (!p)
    return (
      <div className="app-shell">
        <Brand />
        <h1>Necesitas una sesión de explorador</h1>
        <p>Ingresa con tu apodo en este dispositivo para participar.</p>
        <button className="primary" onClick={() => go("/?codigo=" + code)}>
          Unirse a partida
        </button>
      </div>
    );
  return (
    <div
      className={`game student-simple atlas-game view-${mobileView} ${reduced ? "reduce-motion" : ""}`}
    >
      <header className="game-header">
        <button className="brand-button" onClick={() => go("/")}>
          <Brand small />
        </button>
        <span className="tag desktop-only">SALA {code}</span>
        <div className={`timer ${ms < 60000 ? "urgent" : ""}`}>
          <Clock size={18} />
          {s.status === "countdown" ? "00:00" : time(ms)}
        </div>
        <span className="score">
          <Zap size={18} />
          {p.score}
          <small> pts</small>
        </span>
        <SoundButton enabled={sound} setEnabled={setSound} />
        <button
          className="icon-button"
          onClick={() => setReduced(!reduced)}
          aria-label="Reducir movimiento"
          aria-pressed={reduced}
        >
          <Settings size={19} />
        </button>
      </header>
      <div className="game-layout">
        <aside className="mission-nav">
          <span className="eyebrow">TU MISIÓN</span>
          {titles.map((title, i) => (
            <div
              className={`nav-stage ${stage === i ? "current" : ""} ${stage > i ? "completed" : ""}`}
              key={title}
            >
              <span>
                {stage > i ? (
                  <Check size={18} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <div>
                {title}
                <small>
                  {stage > i
                    ? "COMPLETADA"
                    : stage === i
                      ? "EN EXPLORACIÓN"
                      : "BLOQUEADA"}
                </small>
              </div>
              {stage < i && <LockKeyhole size={14} />}
            </div>
          ))}
          <div className="explorer-card">
            <span className="avatar active">{you?.nickname.slice(0, 2)}</span>
            <strong>{you?.nickname}</strong>
            <small>{team ? team.name : "Persona o grupo"}</small>
            <Connection online={online} />
            {team && (
              <p>
                {team.members
                  .map((id) => s.players.find((p) => p.id === id)?.nickname)
                  .join(" · ")}
              </p>
            )}
          </div>
          <button className="ghost" onClick={() => setNotes(!notes)}>
            <FlaskConical size={16} /> Bitácora matemática
          </button>
          {notes && (
            <div className="notes">
              <Formula tex="\nabla f=\lambda\nabla g" />
              <p>{s.problem?.constraint}</p>
              {p.stage > 0 && <p>Modelo: f=xy, variables positivas.</p>}
              {p.stage > 1 && <p>fx=y, fy=x; gx=gy=2 para el rectángulo.</p>}
              {p.stage > 2 && (
                <p>Al igualar x=y y sustituir, se abre la bóveda.</p>
              )}
            </div>
          )}
        </aside>
        <main className="chamber">
          <div className="student-toolbar">
            <span>
              {you?.nickname}
              {team ? " · " + team.name : ""}
            </span>
            <Connection online={online} />
          </div>
          <div className="chamber-title">
            <span className="eyebrow">CÁMARA {Math.min(stage + 1, 4)} / 4</span>
            <h1>{stage >= 4 ? "Misión completada" : titles[stage]}</h1>
            <p>
              {stage >= 4
                ? "La puerta está abierta. Tu resultado está registrado; espera el cierre de la misión."
                : subtitles[stage]}
            </p>
          </div>
          {s.status !== "waiting" && s.status !== "finished" && stage < 4 && (
            <nav className="mobile-play-tabs" aria-label="Vista del juego">
              <button
                aria-pressed={mobileView === "lab"}
                onClick={() => setMobileView("lab")}
              >
                <FlaskConical size={17} />
                Laboratorio
              </button>
              <button
                aria-pressed={mobileView === "console"}
                onClick={() => setMobileView("console")}
              >
                <Zap size={17} />
                Resolver
              </button>
            </nav>
          )}
          {s.status !== "waiting" && s.status !== "finished" && (
            <>
              <div
                className="student-progress"
                aria-label={`Completadas ${stage} de 4 cámaras`}
              >
                {titles.map((t, i) => (
                  <span
                    key={t}
                    className={
                      stage > i ? "complete" : stage === i ? "active" : ""
                    }
                    title={t}
                  >
                    {stage > i ? <Check size={14} /> : i + 1}
                    <small>
                      {["Modelar", "Conectar", "Calibrar", "Demostrar"][i]}
                    </small>
                  </span>
                ))}
              </div>
              {s.problem && (
                <p className="student-problem">{s.problem.statement}</p>
              )}
            </>
          )}
          <ErrorBox text={error} />
          <TeamCompanion s={s} send={send} />
          {s.status !== "finished" && stage < 4 && (
            <MissionBriefing stage={stage} waiting={s.status === "waiting"} />
          )}
          {s.status === "finished" ? (
            <>
              <div className="mission-complete">
                <Trophy size={48} />
                <h2>El conocimiento abrió la puerta.</h2>
                <p>
                  {p.stage}/4 cámaras · {p.correct} pasos correctos · {p.score}{" "}
                  puntos oficiales
                </p>
              </div>
              <Leaderboard s={s} final />
              <ExportImage rows={s.leaderboard} />
            </>
          ) : s.status === "waiting" ? (
            <div className="waiting panel">
              <div className="waiting-researcher">
                <Researcher
                  avatar={you?.avatar ?? 0}
                  label={`Tu personaje: ${you?.nickname}`}
                  pose={you?.ready ? "celebrate" : "idle"}
                />
                <span>
                  IDENTIFICACIÓN ATLAS<strong>{you?.nickname}</strong>
                  <small>{team ? team.name : "Persona o grupo"}</small>
                </span>
              </div>
              <h2>Tu lugar está listo, {you?.nickname}.</h2>
              <div className="waiting-tips">
                <span>
                  <Check size={20} />
                  <strong>Toca y conecta</strong>Elige una pieza y su destino.
                </span>
                <span>
                  <Lightbulb size={20} />
                  <strong>Aprende al intentar</strong>El sistema te orienta en
                  cada paso.
                </span>
                <span>
                  <Users size={20} />
                  <strong>Aporta a tu equipo</strong>Todos comparten el avance.
                </span>
              </div>
              <p>
                Esperando al administrador. La misión comienza al mismo tiempo
                para todos.
              </p>
              <button
                className={you?.ready ? "secondary" : "primary"}
                disabled={!online || busy}
                onClick={() => send("ready")}
              >
                <Check size={18} />
                {you?.ready ? "Preparado · cambiar estado" : "Estoy preparado"}
              </button>
              <p>
                {s.players.length} exploradores en el laboratorio ·{" "}
                {team ? team.name : "Participación por apodo"}
              </p>
            </div>
          ) : (
            <>
              <MissionScene
                s={s}
                draft={worldDraft}
                onOperate={() => setMobileView("console")}
              />
              {stage < 4 && s.problem && (
                <fieldset
                  className="puzzle-fieldset"
                  disabled={
                    s.status !== "running" || !online || busy || blocked
                  }
                >
                  <Puzzle
                    key={`${stage}-${s.problem.resource}`}
                    p={p}
                    problem={s.problem}
                    onAnswer={(data) => send("answer", data)}
                    onDraft={setWorldDraft}
                  />
                </fieldset>
              )}
              {stage >= 4 && (
                <div className="panel success">
                  <DoorOpen size={36} />
                  <h2>Has escapado del laboratorio</h2>
                  <p>
                    Puedes consultar la bitácora y el marcador mientras termina
                    la partida.
                  </p>
                </div>
              )}
              <div className="feedback-bar" aria-live="polite">
                <AudioLines size={20} />
                <p>{p.feedback}</p>
                {stage < 4 && s.config.hints && (
                  <button
                    className="ghost"
                    disabled={!online || busy || s.status !== "running"}
                    onClick={() => send("hint")}
                  >
                    <Lightbulb size={16} /> Pista
                  </button>
                )}
              </div>
              {p.hintText && (
                <div className="hint panel">
                  <Lightbulb size={20} />
                  <p>
                    {p.hintText}
                    <small>
                      La pista reduce la bonificación de esta cámara.
                    </small>
                  </p>
                </div>
              )}
            </>
          )}
          <div className="student-secondary">
            <button
              className="ghost"
              aria-expanded={showDetails}
              onClick={() => setShowDetails(!showDetails)}
            >
              <Trophy size={16} />
              {showDetails ? "Ocultar marcador" : "Ver marcador"}
            </button>
            <button
              className="ghost"
              aria-expanded={notes}
              onClick={() => setNotes(!notes)}
            >
              <FlaskConical size={16} />
              Bitácora
            </button>
          </div>
          {notes && (
            <div className="notes panel">
              <h2>Bitácora matemática</h2>
              <Formula tex="\nabla f=\lambda\nabla g" />
              <p>{s.problem?.constraint}</p>
              {stage > 0 && (
                <p>Función objetivo: f=xy. Variables: x&gt;0, y&gt;0.</p>
              )}
              {stage > 1 && (
                <p>
                  Para el rectángulo: y=2λ, x=2λ, junto con la restricción del
                  perímetro.
                </p>
              )}
              <p>
                Cámaras completadas: {stage}/4 · Pistas: {p.hints} · Errores:{" "}
                {p.errors}
              </p>
            </div>
          )}
        </main>
        <aside className={`game-right ${showDetails ? "show-details" : ""}`}>
          <div className="panel briefing">
            <span className="eyebrow">INFORME DE MISIÓN</span>
            <h3>{s.problem?.title || "Laboratorio desbloqueado"}</h3>
            <p>
              {s.problem?.statement ||
                "Completaste todos los objetivos matemáticos."}
            </p>
            {s.problem && (
              <>
                <Formula
                  tex={
                    s.problem.kind === "rectangle"
                      ? "f(x,y)=xy,\quad 2x+2y=" + s.problem.resource
                      : "f(x,y)=xy,\quad x^2+y^2=" + s.problem.resource
                  }
                />
                <small>Dominio: x &gt; 0, y &gt; 0</small>
              </>
            )}
            <div className="objective-meter">
              <span>Progreso de cámaras</span>
              <strong>{Math.round((stage / 4) * 100)}%</strong>
            </div>
            <div className="mini-progress">
              <span style={{ width: stage * 25 + "%" }} />
            </div>
          </div>
          <Leaderboard s={s} />
        </aside>
      </div>
      {["paused", "countdown"].includes(s.status) && (
        <div className="global-overlay" role="status">
          {s.status === "paused" ? (
            <>
              <Pause size={52} />
              <h2>Misión en pausa</h2>
              <p>El tiempo está congelado. Espera al docente.</p>
            </>
          ) : (
            <>
              <Atom size={52} />
              <h2 className="countdown">{Math.ceil(ms / 1000) || "¡Vamos!"}</h2>
              <p>Preparando sistemas. El laboratorio está por abrir.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
function Puzzle({
  p,
  problem,
  onAnswer,
  onDraft,
}: {
  p: Progress;
  problem: Problem;
  onAnswer: (d: Record<string, string>) => void;
  onDraft: (draft: Record<string, string>) => void;
}) {
  const [activeField, setActiveField] = useState("x"),
    [values, setValues] = useState<Record<string, string>>({}),
    [angle, setAngle] = useState(45);
  const stage = p.stage;
  useEffect(() => onDraft(values), [values, onDraft]);
  if (stage === 0 || stage === 1)
    return <PairBoard p={p} problem={problem} onAnswer={onAnswer} />;
  const field = (key: string, label: string) => (
    <label key={key}>
      {label}
      <input
        aria-label={label}
        inputMode="text"
        placeholder={key === "lambda" ? "Ej. 1/2" : "Valor"}
        maxLength={80}
        value={values[key] || ""}
        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        required
        autoComplete="off"
        onFocus={() => setActiveField(key)}
      />
      {stage === 2 && (
        <div className="dial-controls">
          <button
            type="button"
            aria-label={`Disminuir ${label}`}
            onClick={() =>
              setValues({
                ...values,
                [key]: String(
                  (draftNumber(values[key]) || 0) -
                    (key === "lambda" ? 0.5 : 1),
                ),
              })
            }
          >
            −
          </button>
          <button
            type="button"
            aria-label={`Aumentar ${label}`}
            onClick={() =>
              setValues({
                ...values,
                [key]: String(
                  (draftNumber(values[key]) || 0) +
                    (key === "lambda" ? 0.5 : 1),
                ),
              })
            }
          >
            +
          </button>
        </div>
      )}
    </label>
  );
  return (
    <section className={`puzzle stage-${stage}`}>
      <div className="puzzle-heading">
        <h2>
          {stage === 2 ? "Calibra la combinación" : "Estabiliza la superficie"}
        </h2>
        <span>
          {stage === 2 ? "x · y · λ" : "MODELA · RESUELVE · INTERPRETA"}
        </span>
      </div>
      {stage === 3 && (
        <Surface
          problem={problem}
          angle={angle}
          setAngle={setAngle}
          onUsePoint={(x, y) =>
            setValues({
              ...values,
              x: String(+x.toFixed(5)),
              y: String(+y.toFixed(5)),
            })
          }
        />
      )}
      {stage === 2 && (
        <VaultPreview resource={problem.resource} values={values} />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAnswer(values);
        }}
      >
        {stage === 3 && (
          <div className="grid-2">
            <label>
              Función a maximizar
              <select
                value={values.objective || ""}
                onChange={(e) =>
                  setValues({ ...values, objective: e.target.value })
                }
                required
              >
                <option value="">Seleccionar modelo</option>
                <option value="sum">x + y</option>
                <option value="product">xy</option>
                <option value="squares">x² + y²</option>
              </select>
            </label>
            <label>
              Restricción de energía
              <select
                value={values.constraint || ""}
                onChange={(e) =>
                  setValues({ ...values, constraint: e.target.value })
                }
                required
              >
                <option value="">Seleccionar recurso</option>
                <option value="linear">2x + 2y = {problem.resource}</option>
                <option value="circle">x² + y² = {problem.resource}</option>
                <option value="product">xy = {problem.resource}</option>
              </select>
            </label>
          </div>
        )}
        <div className="vault-dials">
          {field("x", "Dimensión x")}
          {field("y", "Dimensión y")}
          {field("lambda", "Multiplicador λ")}
          {stage === 3 && field("value", "Valor máximo f")}
        </div>
        {stage === 2 && (
          <section className="reasoning-checkpoint">
            <h3>Informe de calibración</h3>
            <p>
              No basta con encontrar números: explica por qué el diseño es
              óptimo.
            </p>
            <label>
              Relación entre las dimensiones
              <select
                required
                value={values.relation || ""}
                onChange={(e) =>
                  setValues({ ...values, relation: e.target.value })
                }
              >
                <option value="">Deducir de las ecuaciones</option>
                <option value="equal">x = y</option>
                <option value="double">x = 2y</option>
                <option value="opposite">x = −y</option>
              </select>
            </label>
            {field("sum", "Suma de dimensiones x + y")}
            <label>
              Justificación del máximo del recinto
              <select
                required
                value={values.proof || ""}
                onChange={(e) =>
                  setValues({ ...values, proof: e.target.value })
                }
              >
                <option value="">Seleccionar argumento</option>
                <option value="stationary">
                  Ser estacionario siempre implica máximo
                </option>
                <option value="square-bound">
                  Con suma fija, xy = n² − (x − n)² ≤ n²
                </option>
                <option value="lambda-positive">
                  λ positivo garantiza cualquier máximo
                </option>
              </select>
            </label>
          </section>
        )}
        <MathKeypad
          field={
            activeField === "lambda"
              ? "λ"
              : activeField === "value"
                ? "valor máximo"
                : activeField
          }
          onKey={(key) => {
            const old = values[activeField] || "";
            const value =
              key === "borrar"
                ? old.slice(0, -1)
                : key === "limpiar"
                  ? ""
                  : key === "−"
                    ? old.startsWith("-")
                      ? old.slice(1)
                      : "-" + old
                    : old + key;
            setValues({ ...values, [activeField]: value.slice(0, 80) });
          }}
        />
        {stage === 3 && (
          <>
            <section className="reasoning-checkpoint">
              <h3>Verificación independiente</h3>
              <label>
                ¿Por qué es regular la restricción?
                <select
                  required
                  value={values.regularity || ""}
                  onChange={(e) =>
                    setValues({ ...values, regularity: e.target.value })
                  }
                >
                  <option value="">Revisar hipótesis del método</option>
                  <option value="nonzero-gradient">
                    ∇g = (2x,2y) ≠ 0 en el dominio positivo
                  </option>
                  <option value="zero-gradient">
                    Porque ∇g = 0 en todos los puntos
                  </option>
                  <option value="positive-value">
                    Porque el valor de f es positivo
                  </option>
                </select>
              </label>
              <p>
                Contrasta tu candidato con el punto factible x ={" "}
                {7 * Math.sqrt(problem.resource / 2)}/5, y ={" "}
                {Math.sqrt(problem.resource / 2)}/5. Calcula su rendimiento xy y
                compara.
              </p>
              {field("probe", "Rendimiento del punto de contraste")}
            </section>
            <div className="grid-2 system-readout">
              {(["eqx", "eqy"] as const).map((key, i) => (
                <label key={key}>
                  {i === 0
                    ? "Ecuación del núcleo en x"
                    : "Ecuación del núcleo en y"}
                  <select
                    value={values[key] || ""}
                    onChange={(e) =>
                      setValues({ ...values, [key]: e.target.value })
                    }
                    required
                  >
                    <option value="">Conectar relación del gradiente</option>
                    <option value={i === 0 ? "y=2lambda" : "x=2lambda"}>
                      {i === 0 ? "y = 2λ" : "x = 2λ"}
                    </option>
                    <option value={i === 0 ? "y=2lambda*x" : "x=2lambda*y"}>
                      {i === 0 ? "y = 2λx" : "x = 2λy"}
                    </option>
                    <option value="same">x = y = λ</option>
                  </select>
                </label>
              ))}
            </div>
            <label>
              ¿Qué demuestra que es un máximo global?
              <select
                value={values.interpretation || ""}
                onChange={(e) =>
                  setValues({ ...values, interpretation: e.target.value })
                }
                required
              >
                <option value="">Elige la interpretación matemática</option>
                <option value="stationary">
                  Todo punto estacionario es un máximo
                </option>
                <option value="upper-bound">
                  2xy ≤ x²+y²; la igualdad se alcanza cuando x=y
                </option>
                <option value="minimum">
                  El producto es mínimo porque x=y
                </option>
              </select>
            </label>
          </>
        )}
        <div className="row between">
          <small>Admite enteros, decimales y fracciones equivalentes.</small>
          <button className="primary">
            <Zap size={17} />
            {stage === 2 ? "Desbloquear bóveda" : "Activar núcleo"}
          </button>
        </div>
      </form>
    </section>
  );
}
function Surface({
  problem: p,
  angle,
  setAngle,
  onUsePoint,
}: {
  problem: Problem;
  angle: number;
  setAngle: (a: number) => void;
  onUsePoint: (x: number, y: number) => void;
}) {
  const R = p.radius!,
    max = R * R;
  const proj = (x: number, y: number, z: number) => [
    230 + ((x - y) * 130) / R,
    205 + ((x + y) * 35) / R - (z * 170) / max,
  ];
  const point = (x: number, y: number) => proj(x, y, x * y).join(",");
  const curve = Array.from({ length: 81 }, (_, i) => {
    const t = ((i / 80) * Math.PI) / 2;
    return point(R * Math.cos(t), R * Math.sin(t));
  }).join(" ");
  const t = (angle * Math.PI) / 180,
    x = R * Math.cos(t),
    y = R * Math.sin(t),
    [cx, cy] = proj(x, y, x * y);
  return (
    <div className="surface">
      <svg
        viewBox="0 0 460 300"
        className="touch-surface"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const local = new DOMPoint(e.clientX, e.clientY).matrixTransform(
            e.currentTarget.getScreenCTM()!.inverse(),
          );
          const px = local.x,
            py = local.y;
          let best = 45,
            distance = Infinity;
          for (let a = 1; a < 90; a++) {
            const t = (a * Math.PI) / 180,
              [x, y] = proj(
                R * Math.cos(t),
                R * Math.sin(t),
                R * R * Math.cos(t) * Math.sin(t),
              );
            const d = (x - px) ** 2 + (y - py) ** 2;
            if (d < distance) {
              distance = d;
              best = a;
            }
          }
          setAngle(best);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const px = new DOMPoint(e.clientX, e.clientY).matrixTransform(
            e.currentTarget.getScreenCTM()!.inverse(),
          ).x;
          const t =
            Math.acos(
              Math.max(-1, Math.min(1, (px - 230) / 130 / Math.SQRT2)),
            ) -
            Math.PI / 4;
          setAngle(Math.max(1, Math.min(89, Math.round((t * 180) / Math.PI))));
        }}
        role="img"
        aria-label="Superficie z=xy y arco de restricción en el primer cuadrante"
      >
        <g stroke="#25415a" fill="none">
          {Array.from({ length: 11 }, (_, i) => (
            <React.Fragment key={i}>
              <polyline
                points={Array.from({ length: 21 }, (_, j) =>
                  point((i / 10) * R, (j / 20) * R),
                ).join(" ")}
              />
              <polyline
                points={Array.from({ length: 21 }, (_, j) =>
                  point((j / 20) * R, (i / 10) * R),
                ).join(" ")}
              />
            </React.Fragment>
          ))}
        </g>
        <polyline points={curve} stroke="#a78bfa" strokeWidth="4" fill="none" />
        <path
          d={`M230 205L360 240M230 205L100 240M230 205V50`}
          stroke="#55728d"
          fill="none"
        />
        <circle
          cx={cx}
          cy={cy}
          r="6"
          fill="#22d3ee"
          stroke="white"
          strokeWidth="2"
        />
        <g fill="#a4b7cf" fontSize="13">
          <text x="370" y="247">
            x
          </text>
          <text x="80" y="247">
            y
          </text>
          <text x="235" y="45">
            z=xy
          </text>
          <text x="20" y="25">
            Restricción: x²+y²={p.resource}
          </text>
          <text x="20" y="280">
            x={x.toFixed(2)} · y={y.toFixed(2)} · f={Number(x * y).toFixed(2)}
          </text>
        </g>
      </svg>
      <label>
        Mueve el punto azul: toca la curva o desliza el control
        <input
          type="range"
          min="1"
          max="89"
          value={angle}
          onChange={(e) => setAngle(+e.target.value)}
        />
      </label>
      <button
        type="button"
        className="secondary"
        onClick={() => onUsePoint(x, y)}
      >
        Usar este punto como candidato
      </button>
      <small className="surface-help">
        Solo copia x e y a tus controles. Aún debes construir el sistema,
        calcular λ y justificar el máximo.
      </small>
    </div>
  );
}
function App() {
  const [path, go] = usePath();
  const match = /^\/(jugar|presentacion)\/([A-Z2-9]{6})$/.exec(path);
  if (path === "/admin") return <Admin go={go} />;
  if (match)
    return match[1] === "jugar" ? (
      <Game code={match[2]} go={go} />
    ) : (
      <Presentation code={match[2]} />
    );
  return <Home go={go} />;
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
