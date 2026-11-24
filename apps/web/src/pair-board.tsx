import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { Problem, Progress } from "../../../packages/shared";
type Wire = { piece: string; target: string; path: string; preview: boolean };
export function PairBoard({
  p,
  problem,
  onAnswer,
}: {
  p: Progress;
  problem: Problem;
  onAnswer: (data: Record<string, string>) => void;
}) {
  const [selected, setSelected] = useState(""),
    [destination, setDestination] = useState(""),
    [hoverTarget, setHoverTarget] = useState(""),
    [pending, setPending] = useState<{ piece: string; target: string }>(),
    [wires, setWires] = useState<Wire[]>([]);
  const root = useRef<HTMLDivElement>(null),
    sources = useRef(new Map<string, HTMLSpanElement>()),
    targets = useRef(new Map<string, HTMLSpanElement>());
  const choices = p.stage === 0 ? problem.pieces : problem.connections,
    slots = p.stage === 0 ? problem.slots : problem.targets;
  const shuffled = [...choices].sort(
    (a, b) =>
      ((a.label.length * 7 + problem.resource) % 13) -
      ((b.label.length * 7 + problem.resource) % 13),
  );
  const links = p.links || {},
    used = new Set(Object.values(links)),
    linkKey = JSON.stringify(links),
    choiceKey = choices.map((c) => c.id + c.label).join("|");
  useEffect(() => {
    setPending(undefined);
  }, [p]);
  useEffect(() => {
    if (used.has(selected)) setSelected("");
    if (p.done.includes(destination)) setDestination("");
  }, [linkKey, selected, destination, p.done]);
  useLayoutEffect(() => {
    let alive = true,
      frame = 0;
    const measure = () => {
      if (!alive) return;
      const area = root.current?.getBoundingClientRect();
      if (!area || !area.width || !area.height) {
        setWires((old) => (old.length ? [] : old));
        return;
      }
      const pairs = Object.entries(links).map(([target, piece]) => ({
        target,
        piece,
        preview: false,
      }));
      const preview =
        pending ||
        (selected && hoverTarget && !p.done.includes(hoverTarget)
          ? { piece: selected, target: hoverTarget }
          : undefined);
      if (preview && !links[preview.target] && !used.has(preview.piece))
        pairs.push({ ...preview, preview: true });
      const next: Wire[] = [];
      for (const pair of pairs) {
        const from = sources.current.get(pair.piece)?.getBoundingClientRect(),
          to = targets.current.get(pair.target)?.getBoundingClientRect();
        if (!from || !to) continue;
        const x1 = from.left + from.width / 2 - area.left,
          y1 = from.top + from.height / 2 - area.top,
          x2 = to.left + to.width / 2 - area.left,
          y2 = to.top + to.height / 2 - area.top,
          bend = Math.max(6, (x2 - x1) / 2);
        next.push({
          ...pair,
          path: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
        });
      }
      setWires((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    if (root.current) {
      observer.observe(root.current);
      root.current
        .querySelectorAll("button")
        .forEach((el) => observer.observe(el));
    }
    window.addEventListener("resize", schedule);
    document.fonts.ready.then(() => {
      if (alive) schedule();
    });
    measure();
    return () => {
      alive = false;
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [linkKey, choiceKey, selected, hoverTarget, pending, p.done]);
  function clear() {
    setSelected("");
    setDestination("");
    setHoverTarget("");
    setPending(undefined);
  }
  function connect(target: string, piece = selected) {
    if (p.done.includes(target) || links[target]) return;
    if (!piece) {
      setDestination(target);
      setSelected("");
      setHoverTarget("");
      return;
    }
    if (used.has(piece) || !choices.some((c) => c.id === piece)) return;
    setPending({ target, piece });
    onAnswer({ target, piece });
    setSelected("");
    setDestination("");
    setHoverTarget("");
  }
  const pairNumber = (target: string) => Object.keys(links).indexOf(target) + 1;
  return (
    <section className={`puzzle connections stage-${p.stage}`}>
      <div className="puzzle-heading">
        <h2>
          {p.stage === 0 ? "Ensambla el reactor" : "Restaura el circuito"}
        </h2>
        <span>
          {p.done.length}/{slots.length} conexiones
        </span>
      </div>
      <p className="interaction-help">
        {destination
          ? "Ahora elige la pieza que quieres conectar."
          : selected
            ? "Pieza seleccionada. Toca el destino para conectarla."
            : "Toca una pieza y un destino. Los pares correctos quedan conectados y bloqueados."}
      </p>
      {(selected || destination) && (
        <div className="selection-summary">
          <span>
            {selected
              ? `Seleccionaste: ${choices.find((c) => c.id === selected)?.label}`
              : `Destino: ${slots.find((t) => t.id === destination)?.label}`}
          </span>
          <button type="button" className="ghost" onClick={clear}>
            Cancelar selección
          </button>
        </div>
      )}
      <div className="connection-layout actual-pairs" ref={root}>
        <div className="pieces">
          {shuffled.map((c) => {
            const matched = Object.keys(links).find(
              (target) => links[target] === c.id,
            );
            return (
              <button
                type="button"
                key={c.id}
                data-piece-id={c.id}
                disabled={!!matched}
                aria-disabled={!!matched}
                draggable={!matched}
                className={`piece ${selected === c.id ? "selected" : ""} ${matched ? "done" : ""}`}
                aria-pressed={selected === c.id}
                onDragStart={(e) => {
                  if (matched) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData("text/plain", c.id);
                  setSelected(c.id);
                  setHoverTarget("");
                }}
                onDragEnd={() => {
                  setSelected("");
                  setHoverTarget("");
                }}
                onClick={() => {
                  if (matched || used.has(c.id)) return;
                  if (destination) connect(destination, c.id);
                  else {
                    setSelected(c.id);
                    setHoverTarget("");
                  }
                }}
              >
                <span className="pair-label">{c.label}</span>
                {matched && (
                  <span
                    className="pair-badge"
                    aria-label={`Par ${pairNumber(matched)} completado`}
                  >
                    {pairNumber(matched)}
                    <Check size={12} />
                    <span className="pair-completed-label">Completado</span>
                  </span>
                )}
                <span
                  className="socket pair-port output-port"
                  aria-hidden="true"
                  ref={(el) => {
                    if (el) sources.current.set(c.id, el);
                    else sources.current.delete(c.id);
                  }}
                />
              </button>
            );
          })}
        </div>
        <div className="wire-gap" aria-hidden="true" />
        <div className="targets">
          {slots.map((t) => {
            const done = p.done.includes(t.id);
            return (
              <button
                type="button"
                key={t.id}
                data-target-id={t.id}
                disabled={done}
                aria-disabled={done}
                className={`target ${done ? "done" : ""} ${destination === t.id ? "selected-destination" : ""} ${selected && !done ? "available-target" : ""}`}
                onMouseEnter={() => {
                  if (!done) setHoverTarget(t.id);
                }}
                onMouseLeave={() => setHoverTarget("")}
                onDragOver={(e) => {
                  if (!done) {
                    e.preventDefault();
                    setHoverTarget(t.id);
                  }
                }}
                onDragLeave={() => setHoverTarget("")}
                onDrop={(e) => {
                  e.preventDefault();
                  connect(t.id, e.dataTransfer.getData("text/plain"));
                }}
                onClick={() => connect(t.id)}
              >
                <span
                  className="socket pair-port input-port"
                  aria-hidden="true"
                  ref={(el) => {
                    if (el) targets.current.set(t.id, el);
                    else targets.current.delete(t.id);
                  }}
                />
                <span className="pair-label">{t.label}</span>
                {done ? (
                  <span
                    className="pair-badge"
                    aria-label={`Par ${pairNumber(t.id)} completado`}
                  >
                    {pairNumber(t.id)}
                    <Check size={12} />
                    <span className="pair-completed-label">Completado</span>
                  </span>
                ) : (
                  <span className="target-status">
                    {selected ? "TOCA AQUÍ" : "CONECTAR"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <svg className="pair-wires" aria-hidden="true">
          {wires.map((w) => (
            <g
              key={`${w.preview ? "preview" : "confirmed"}-${w.target}`}
              data-from={w.piece}
              data-to={w.target}
              data-confirmed={!w.preview}
            >
              {!w.preview && (
                <title>{`Par ${pairNumber(w.target)} completado`}</title>
              )}
              <path d={w.path} className="wire-underlay" />
              <path
                d={w.path}
                className={
                  w.preview
                    ? "pair-wire preview-wire"
                    : "pair-wire confirmed-wire"
                }
              />
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
