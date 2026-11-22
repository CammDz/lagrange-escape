import { describe, it, expect } from "vitest";
import {
  rectangleSizes,
  circleSizes,
  problem,
  official,
  validate,
  numeric,
  classify,
  near,
} from "../packages/math";
describe("Parser sin ejecución de código", () => {
  it.each([
    ["5/2", 2.5],
    ["-3/2", -1.5],
    ["0,5", 0.5],
    [" .25 ", 0.25],
    ["1/-2", -0.5],
  ])("%s", (s, n) => expect(numeric(String(s))).toBe(n));
  it.each([
    "1/0",
    "Infinity",
    "NaN",
    "1+1",
    "2**3",
    "globalThis",
    "<script>",
    "1/2/3",
    "",
    "1e99",
  ])("rechaza %s", (s) => expect(numeric(s)).toBeNull());
});
for (const kind of ["rectangle", "circle"] as const)
  for (const n of kind === "rectangle" ? rectangleSizes : circleSizes)
    describe(`${kind}, n=${n}`, () => {
      const p = problem(kind, n),
        s = official(p),
        stage = kind === "rectangle" ? 2 : 3;
      const data = {
        x: String(s.x),
        y: String(s.y),
        lambda: String(s.lambda),
        value: String(s.value),
        objective: "product",
        constraint: "circle",
        interpretation: "upper-bound",
        sum: String(2 * n),
        relation: "equal",
        proof: "square-bound",
        regularity: "nonzero-gradient",
        probe: String((7 * n * n) / 25),
        eqx: "y=2lambda*x",
        eqy: "x=2lambda*y",
      };
      it("valida solución y fracción equivalente", () => {
        expect(validate(stage, data, p, []).correct).toBe(true);
        expect(
          validate(
            stage,
            { ...data, lambda: kind === "rectangle" ? `${n}/2` : "2/4" },
            p,
            [],
          ).correct,
        ).toBe(true);
      });
      it("comprueba factibilidad, gradientes y regularidad por diferencias finitas", () => {
        const g = (x: number, y: number) =>
          kind === "rectangle"
            ? 2 * x + 2 * y - 4 * n
            : x * x + y * y - 2 * n * n;
        const h = 1e-4;
        const gx = (g(n + h, n) - g(n - h, n)) / (2 * h),
          gy = (g(n, n + h) - g(n, n - h)) / (2 * h);
        expect(Math.hypot(gx, gy)).toBeGreaterThan(0);
        expect(near(n, s.lambda * gx)).toBe(true);
        expect(near(n, s.lambda * gy)).toBe(true);
        expect(g(n, n)).toBe(0);
      });
      it("máximo global por muestreo independiente de puntos factibles", () => {
        for (let i = 1; i < 100; i++) {
          const x =
            kind === "rectangle"
              ? (2 * n * i) / 100
              : Math.sqrt(2) * n * Math.cos(((Math.PI / 2) * i) / 100);
          const y =
            kind === "rectangle" ? 2 * n - x : Math.sqrt(2 * n * n - x * x);
          expect(x * y).toBeLessThanOrEqual(n * n + 1e-8);
        }
        expect(classify(p).classification).toBe("maximum");
      });
      it("rechaza λ incorrecto, puntos fuera del dominio y candidatos no factibles", () => {
        for (const d of [
          { lambda: "0" },
          { x: "0" },
          { x: "-1" },
          { y: String(n + 1) },
          { x: "1/0" },
        ])
          expect(validate(stage, { ...data, ...d }, p, []).correct).toBe(false);
      });
      if (kind === "circle")
        it("exige valor y clasificación correcta", () => {
          expect(validate(stage, { ...data, value: "0" }, p, []).correct).toBe(
            false,
          );
          expect(
            validate(stage, { ...data, interpretation: "stationary" }, p, [])
              .correct,
          ).toBe(false);
        });
    });
it("conectores válidos, distractores y errores específicos", () => {
  const p = problem("rectangle", 5);
  for (const slot of p.slots)
    expect(
      validate(0, { target: slot.id, piece: slot.id }, p, []).correct,
    ).toBe(true);
  for (const t of p.targets)
    expect(validate(1, { target: t.id, piece: t.id }, p, []).correct).toBe(
      true,
    );
  expect(
    validate(0, { target: "objective", piece: "decoy" }, p, []).message,
  ).toContain("área");
  expect(validate(1, { target: "fx", piece: "fy" }, p, []).correct).toBe(false);
});
