import type { Problem } from "../shared";
export interface MathProblem extends Problem {
  n: number;
}
// Server-only module: never import this module into apps/web.
export const rectangleSizes = [3, 4, 5, 6, 7, 8, 9, 10];
export const circleSizes = [2, 3, 4, 5, 6, 7, 8, 9];
export function numeric(input: string | undefined): number | null {
  if (!input || input.length > 80) return null;
  const s = input.trim().replace(",", ".");
  const m =
    /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*\/\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)))?$/.exec(
      s,
    );
  if (!m) return null;
  const a = Number(m[1]),
    b = m[2] === undefined ? 1 : Number(m[2]);
  const n = a / b;
  return b !== 0 && Number.isFinite(n) && Math.abs(n) < 1e9 ? n : null;
}
export const near = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b));
export function problem(kind: "rectangle" | "circle", n: number): MathProblem {
  const rect = kind === "rectangle",
    c = rect ? 4 * n : 2 * n * n;
  return {
    kind,
    n,
    resource: c,
    title: rect
      ? "Recinto de cultivo experimental"
      : "Asignación de energía del núcleo",
    statement: rect
      ? `El laboratorio dispone de ${c} m de cerca para un recinto rectangular de cultivo. Determina el diseño con mayor superficie útil; ambos lados deben ser positivos.`
      : `Dos canales de un núcleo experimental entregan un rendimiento conjunto f(x,y)=xy. El presupuesto de energía exige x²+y²=${c}, con x>0 e y>0 en unidades normalizadas. Calcula el máximo global y justifica por qué no puede superarse.`,
    objective: "f(x,y)=xy",
    constraint: rect ? `2x+2y=${c}` : `x²+y²=${c}`,
    domain: "x>0, y>0",
    radius: rect ? undefined : Math.sqrt(c),
    pieces: [
      { id: "variables", label: "x, y: dimensiones positivas" },
      { id: "objective", label: "f(x,y) = xy" },
      { id: "constraint", label: rect ? `2x + 2y = ${c}` : `x² + y² = ${c}` },
      { id: "constant", label: String(c) },
      { id: "decoy", label: rect ? "f(x,y) = 2x + 2y" : "f(x,y) = x² + y²" },
    ],
    slots: [
      { id: "variables", label: "Variables y dominio" },
      { id: "objective", label: "Función objetivo" },
      { id: "constraint", label: "Restricción" },
      { id: "constant", label: "Constante del recurso" },
    ],
    connections: [
      { id: "fx", label: "y" },
      { id: "fy", label: "x" },
      { id: "gx", label: rect ? "2" : "2x" },
      { id: "gy", label: rect ? "2" : "2y" },
      { id: "eqx", label: rect ? "y = 2λ" : "y = 2λx" },
      { id: "eqy", label: rect ? "x = 2λ" : "x = 2λy" },
      { id: "constraint", label: rect ? `2x + 2y = ${c}` : `x² + y² = ${c}` },
    ],
    targets: [
      { id: "fx", label: "∂f/∂x" },
      { id: "fy", label: "∂f/∂y" },
      { id: "gx", label: "∂g/∂x" },
      { id: "gy", label: "∂g/∂y" },
      { id: "eqx", label: "Ecuación en x" },
      { id: "eqy", label: "Ecuación en y" },
      { id: "constraint", label: "Cerrar con g = 0" },
    ],
  };
}
export function publicProblem(
  stage: number,
  variants: [number, number],
): MathProblem {
  return stage === 3
    ? problem("circle", circleSizes[variants[1]])
    : problem("rectangle", rectangleSizes[variants[0]]);
}
export function official(p: MathProblem) {
  return {
    x: p.n,
    y: p.n,
    lambda: p.kind === "rectangle" ? p.n / 2 : 0.5,
    value: p.n * p.n,
  };
}
export function classify(p: MathProblem) {
  return {
    regular: true,
    classification: "maximum",
    justification:
      p.kind === "rectangle"
        ? "Con x+y=2n, xy=n²−(x−n)²≤n². La igualdad solo ocurre en x=y=n; los extremos del cierre tienen área cero."
        : "De (x−y)²≥0 se obtiene 2xy≤x²+y²=2n². La igualdad ocurre solo en x=y=n dentro del dominio positivo. El ínfimo 0 en el dominio abierto no se alcanza.",
  };
}
export interface Validation {
  correct: boolean;
  key: string;
  message: string;
  complete?: boolean;
}
export function validate(
  stage: number,
  data: Record<string, string>,
  p: MathProblem,
  done: string[],
): Validation {
  const bad = (message: string): Validation => ({
    correct: false,
    key: "",
    message,
  });
  if (stage === 0 || stage === 1) {
    const targets = stage === 0 ? p.slots : p.targets;
    const t = targets.find((t) => t.id === data.target);
    if (!t) return bad("Elige un conector válido.");
    const choices = stage === 0 ? p.pieces : p.connections;
    const chosen = choices.find((c) => c.id === data.piece),
      expected = choices.find((c) => c.id === t.id);
    const correct = !!chosen && !!expected && chosen.label === expected.label;
    return {
      correct,
      key: t.id,
      message: correct
        ? done.includes(t.id)
          ? "Este mecanismo ya está conectado."
          : "Conexión estable. El circuito recibe energía."
        : stage === 0
          ? "La función objetivo mide el área xy. La restricción describe el recurso disponible; su constante es el perímetro."
          : `Revisa ${t.label}: deriva respecto de la variable indicada, mantén la otra constante y usa ∇f=λ∇g.`,
    };
  }
  const x = numeric(data.x),
    y = numeric(data.y),
    l = numeric(data.lambda);
  if (x === null || y === null || l === null)
    return bad(
      "Introduce números, decimales o fracciones válidas (por ejemplo 5/2).",
    );
  if (x <= 0 || y <= 0) return bad("El dominio exige x>0 y y>0.");
  const feasible =
    p.kind === "rectangle"
      ? near(2 * x + 2 * y, 4 * p.n)
      : near(x * x + y * y, 2 * p.n * p.n);
  if (!feasible)
    return bad("El punto no cumple la restricción: revisa el recurso total.");
  if (
    !near(y, l * (p.kind === "rectangle" ? 2 : 2 * x)) ||
    !near(x, l * (p.kind === "rectangle" ? 2 : 2 * y))
  )
    return bad(
      "El punto es factible, pero no cumple ambas ecuaciones del gradiente. Revisa λ y las derivadas.",
    );
  const s = official(p);
  if (!near(x, s.x) || !near(y, s.y))
    return bad("Comprueba todos los candidatos en el dominio.");
  if (stage === 2) {
    const sum = numeric(data.sum);
    if (data.relation !== "equal" || sum === null || !near(sum, p.resource / 2))
      return bad(
        "Deduce x=y de las dos ecuaciones y calcula x+y dividiendo el perímetro entre dos.",
      );
    if (data.proof !== "square-bound")
      return bad(
        "Con x+y fijo, usa xy=n²−(x−n)²≤n² para justificar el máximo global. Un punto estacionario no es suficiente.",
      );
  }
  if (stage === 3) {
    if (data.regularity !== "nonzero-gradient")
      return bad(
        "Revisa la regularidad: ∇g=(2x,2y) es distinto de cero en el dominio positivo.",
      );
    const probe = numeric(data.probe);
    if (probe === null || !near(probe, (7 * p.n * p.n) / 25))
      return bad(
        "Evalúa también el punto factible de contraste: multiplica sus dos coordenadas y compara su rendimiento con el candidato óptimo.",
      );
    if (data.eqx !== "y=2lambda*x" || data.eqy !== "x=2lambda*y")
      return bad(
        "Construye ambas relaciones: la derivada de x² es 2x y la de y² es 2y; multiplica cada una por λ.",
      );
    if (data.objective !== "product" || data.constraint !== "circle")
      return bad(
        "Modela la transferencia como xy y el recurso como la suma de cuadrados.",
      );
    const v = numeric(data.value);
    if (v === null || !near(v, s.value))
      return bad(
        "Evalúa f(x,y)=xy en el punto candidato para obtener el valor óptimo.",
      );
    if (data.interpretation !== "upper-bound")
      return bad(
        "Un punto estacionario no basta: usa 2xy≤x²+y² para justificar una cota superior alcanzable.",
      );
  }
  return {
    correct: true,
    key: "solution",
    complete: true,
    message:
      stage === 3
        ? classify(p).justification
        : "Ambas relaciones del gradiente y la restricción se cumplen. La bóveda se abre.",
  };
}
export function hint(stage: number, p: MathProblem) {
  return [
    "Distingue lo que quieres maximizar (área) de lo que tienes disponible (cerca). Las dimensiones son positivas.",
    "Para f=xy: fx=y y fy=x. La derivada de 2x+2y−P respecto de cada variable es 2.",
    "De y=2λ y x=2λ deduce x=y. Sustituye en el perímetro y después calcula λ.",
    `Escribe y=2λx y x=2λy. Como x,y>0, se deduce x=y. Usa (x−y)²≥0 para probar que xy≤${p.n * p.n}.`,
  ][stage];
}
