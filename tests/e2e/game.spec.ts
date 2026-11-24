import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const size = (p: any) =>
  p.kind === "rectangle" ? p.resource / 4 : Math.sqrt(p.resource / 2);
const password = () =>
  process.env.TEST_ADMIN_PASSWORD ||
  JSON.parse(
    readFileSync(new URL("../../work/test-auth.json", import.meta.url), "utf8"),
  ).password;
test("docente y dos navegadores completan una partida real", async ({
  browser,
}) => {
  const admin = await browser.newContext(),
    student = await browser.newContext(),
    second = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
  const a = await admin.newPage(),
    p = await student.newPage(),
    q = await second.newPage();
  await a.goto("/admin");
  await a.getByLabel("Contraseña", { exact: true }).fill(password());
  await a.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await a.getByRole("button", { name: "Nueva partida" }).click();
  await a.getByLabel("Nombre de la partida").fill("Prueba navegador");
  await a.getByRole("button", { name: "Crear partida", exact: true }).click();
  await expect(
    a.getByRole("button", { name: "Iniciar partida", exact: true }),
  ).toBeVisible();
  const code = await a.locator(".section-heading .room-code").innerText();
  await a.getByRole("button", { name: "Generar enlace de ingreso" }).click();
  await expect(a.getByLabel("Enlace para estudiantes")).toHaveValue(
    "http://localhost:5180/?codigo=" + code,
  );
  for (const [page, name] of [
    [p, "Ada"],
    [q, "Emmy"],
  ] as const) {
    await page.goto("/?codigo=" + code);
    await expect(page.getByLabel("Tu apodo")).toBeVisible();
    await page.getByLabel("Tu apodo").fill(name);
    await expect(page.locator(".join-card input")).toHaveCount(1);
    await expect(page.locator(".join-card select")).toHaveCount(0);
    await page.getByRole("button", { name: "Entrar al laboratorio" }).click();
    await expect(
      page.getByRole("button", { name: "Estoy preparado" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Estoy preparado" }).click();
  }
  await a.getByRole("button", { name: "Iniciar partida", exact: true }).click();
  await expect(p.getByText("Preparando sistemas.")).toBeVisible();
  await expect(p.locator(".global-overlay")).toHaveCount(0, { timeout: 10000 });
  await p
    .getByRole("button", { name: "Examinar reactor", exact: true })
    .click();
  await expect(
    p.getByText("Necesita cuatro conexiones:", { exact: false }),
  ).toBeVisible();
  await expect(p.locator(".protagonist")).toHaveClass(/work/);
  await p
    .getByRole("button", { name: "Conectar las piezas", exact: true })
    .click();
  await expect(p.locator(".inspection-card")).toHaveCount(0);
  await q.getByRole("button", { name: "Resolver", exact: true }).tap();
  await expect(q.locator(".mission-experience")).toBeHidden();
  await expect(q.locator(".puzzle-fieldset")).toBeVisible();
  await q.locator(".target").filter({ hasText: "Variables y dominio" }).tap();
  await expect(q.locator(".selection-summary")).toContainText(
    "Variables y dominio",
  );
  await q
    .locator(".piece")
    .filter({ hasText: "x, y: dimensiones positivas" })
    .tap();
  await expect(
    q.locator(".target").filter({ hasText: "Variables y dominio" }),
  ).toHaveClass(/done/);
  await expect(
    q.locator(".piece").filter({ hasText: "x, y: dimensiones positivas" }),
  ).toBeDisabled();
  const completedSource = q
      .locator(".piece")
      .filter({ hasText: "x, y: dimensiones positivas" }),
    completedTarget = q
      .locator(".target")
      .filter({ hasText: "Variables y dominio" });
  await expect(completedTarget).toBeDisabled();
  await expect(completedSource).toContainText("Completado");
  await expect(completedTarget).toContainText("Completado");
  await completedSource.dispatchEvent("click");
  await expect(completedSource).toHaveAttribute("aria-pressed", "false");
  await expect(q.locator(".selection-summary")).toHaveCount(0);
  await expect(q.locator('.pair-wires g[data-confirmed="true"]')).toHaveCount(
    1,
  );
  await q.reload();
  await q.getByRole("button", { name: "Resolver", exact: true }).click();
  await expect(
    q.locator(".piece").filter({ hasText: "x, y: dimensiones positivas" }),
  ).toBeDisabled();
  await expect(q.locator('.pair-wires g[data-confirmed="true"]')).toHaveCount(
    1,
  );
  for (const width of [320, 375, 390, 430]) {
    await q.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        q.evaluate(() => {
          const svg = document.querySelector(".pair-wires") as SVGSVGElement,
            group = svg.querySelector('g[data-confirmed="true"]')!,
            path = group.querySelector(".pair-wire") as SVGPathElement;
          const from = document
              .querySelector(
                `[data-piece-id="${group.getAttribute("data-from")}"] .output-port`,
              )!
              .getBoundingClientRect(),
            to = document
              .querySelector(
                `[data-target-id="${group.getAttribute("data-to")}"] .input-port`,
              )!
              .getBoundingClientRect();
          const start = path
              .getPointAtLength(0)
              .matrixTransform(svg.getScreenCTM()!),
            end = path
              .getPointAtLength(path.getTotalLength())
              .matrixTransform(svg.getScreenCTM()!);
          return Math.max(
            Math.hypot(
              start.x - from.left - from.width / 2,
              start.y - from.top - from.height / 2,
            ),
            Math.hypot(
              end.x - to.left - to.width / 2,
              end.y - to.top - to.height / 2,
            ),
          );
        }),
      )
      .toBeLessThan(2);
  }
  await q.setViewportSize({ width: 390, height: 844 });
  await expect(
    p.getByRole("button", { name: "Ver marcador", exact: true }),
  ).toBeVisible();
  await expect(p.locator(".game-right")).toBeHidden();
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await p.setViewportSize({ width, height: 900 });
    expect(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await p.screenshot({ path: "docs/estudiante-desktop.png", fullPage: true });
  await q.screenshot({ path: "docs/estudiante-mobile.png", fullPage: true });
  await a.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(a.getByRole("button", { name: /Expulsar a / })).toHaveCount(0);
  const participant = (
    await (await student.request.get("/api/rooms/" + code + "/snapshot")).json()
  ).you;
  const kick = await admin.request.post(
    "http://localhost:5180/api/rooms/" + code + "/kick",
    { headers: { Origin: "http://localhost:5180" }, data: { id: participant } },
  );
  expect(kick.status()).toBe(409);
  await expect(
    p.getByRole("heading", { name: "Misión en pausa" }),
  ).toBeVisible();
  await expect(
    q.getByRole("heading", { name: "Misión en pausa" }),
  ).toBeVisible();
  await a.getByRole("button", { name: "Reanudar" }).click();
  await expect(p.locator(".global-overlay")).toHaveCount(0);
  const state = async () =>
    await (
      await student.request.get("/api/rooms/" + code + "/snapshot")
    ).json();
  const own = await state();
  expect(
    own.players.find((person: { id: string }) => person.id === own.you).avatar,
  ).toBeGreaterThanOrEqual(0);
  await p.locator(".piece").filter({ hasText: "f(x,y) = 2x + 2y" }).click();
  await p.locator(".target").filter({ hasText: "Función objetivo" }).click();
  await expect(p.locator(".feedback-bar")).toContainText("área xy");
  for (let stage = 0; stage < 2; stage++) {
    let s = await state();
    const items = stage === 0 ? s.problem.slots : s.problem.targets;
    for (let i = 0; i < items.length; i++) {
      s = await state();
      const item = items[i],
        piece = (stage === 0 ? s.problem.pieces : s.problem.connections).find(
          (c: { label: string }) =>
            c.label ===
            (
              {
                variables: "x, y: dimensiones positivas",
                objective: "f(x,y) = xy",
                constraint: `2x + 2y = ${s.problem.resource}`,
                constant: String(s.problem.resource),
                fx: "y",
                fy: "x",
                gx: "2",
                gy: "2",
                eqx: "y = 2λ",
                eqy: "x = 2λ",
              } as Record<string, string>
            )[item.id],
        );
      await p
        .locator(".piece:not(:disabled)")
        .getByText(piece.label, { exact: true })
        .first()
        .click();
      await p.locator(".target").getByText(item.label, { exact: true }).click();
      if (i < items.length - 1)
        await expect(
          p.locator(".target").filter({ hasText: item.label }),
        ).toHaveClass(/done/);
      else
        await expect(p.locator(".chamber-title .eyebrow")).toContainText(
          "CÁMARA " + (stage + 2),
        );
    }
  }
  let s = await state();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.getByRole("button", { name: "Resolver", exact: true }).click();
  await p.getByLabel("Relación entre las dimensiones").selectOption("equal");
  await p
    .getByLabel("Suma de dimensiones x + y", { exact: true })
    .fill(String(2 * size(s.problem)));
  await p
    .getByLabel("Justificación del máximo del recinto")
    .selectOption("square-bound");
  await p
    .getByRole("button", { name: "Aumentar Dimensión x", exact: true })
    .click();
  await expect(p.getByLabel("Dimensión x", { exact: true })).toHaveValue("1");
  await p.getByRole("button", { name: "Abrir teclado matemático" }).click();
  await expect(p.locator(".keypad-keys")).toBeVisible();
  await p.getByRole("button", { name: "Ocultar teclado matemático" }).click();
  await expect(p.locator(".vault-preview")).toBeVisible();
  await p
    .getByLabel("Dimensión x", { exact: true })
    .fill(String(size(s.problem)));
  await p
    .getByLabel("Dimensión y", { exact: true })
    .fill(String(size(s.problem)));
  await p
    .getByLabel("Multiplicador λ", { exact: true })
    .fill(size(s.problem) + "/2");
  await p.getByRole("button", { name: "Desbloquear bóveda" }).click();
  await expect(p.locator(".chamber-title .eyebrow")).toContainText("CÁMARA 4");
  await p.getByRole("button", { name: "Resolver", exact: true }).click();
  await expect(
    p.getByRole("heading", { name: "Estabiliza la superficie" }),
  ).toBeVisible();
  s = await state();
  await p
    .getByLabel("¿Por qué es regular la restricción?")
    .selectOption("nonzero-gradient");
  await p
    .getByLabel("Rendimiento del punto de contraste", { exact: true })
    .fill(String((7 * size(s.problem) ** 2) / 25));
  await p
    .getByRole("button", { name: "Usar este punto como candidato" })
    .click();
  await expect(p.getByLabel("Dimensión x", { exact: true })).toHaveValue(
    String(size(s.problem)),
  );
  await p.getByLabel("Función a maximizar").selectOption("product");
  await p.getByLabel("Ecuación del núcleo en x").selectOption("y=2lambda*x");
  await p.getByLabel("Ecuación del núcleo en y").selectOption("x=2lambda*y");
  await p.getByLabel("Restricción de energía").selectOption("circle");
  await p
    .getByLabel("Dimensión x", { exact: true })
    .fill(String(size(s.problem)));
  await p
    .getByLabel("Dimensión y", { exact: true })
    .fill(String(size(s.problem)));
  await p.getByLabel("Multiplicador λ", { exact: true }).fill("1/2");
  expect(
    await p
      .getByLabel("Multiplicador λ", { exact: true })
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await p
    .getByLabel("Valor máximo f")
    .fill(String(size(s.problem) * size(s.problem)));
  await p
    .getByLabel("¿Qué demuestra que es un máximo global?")
    .selectOption("upper-bound");
  await p.getByRole("button", { name: "Activar núcleo" }).click();
  await expect(
    p.getByRole("heading", { name: "Has escapado del laboratorio" }),
  ).toBeVisible();
  await p.reload();
  await expect(
    p.getByRole("img", { name: "Tu personaje: Ada", exact: true }),
  ).toBeVisible();
  await expect(
    p.getByRole("heading", { name: "Has escapado del laboratorio" }),
  ).toBeVisible();
  await a.getByRole("button", { name: "Finalizar ahora" }).click();
  await expect(
    p.getByRole("heading", { name: "Resultados oficiales" }),
  ).toBeVisible();
  await expect(p.locator(".podium")).toContainText("Ada");
  const projection = await second.newPage();
  await projection.goto("/presentacion/" + code);
  await expect(
    projection.getByRole("heading", { name: "Resultados oficiales" }),
  ).toBeVisible();
  await expect(projection.getByRole("button", { name: "Pausar" })).toHaveCount(
    0,
  );
  await p.screenshot({ path: "docs/podio-desktop.png", fullPage: true });
  await q.screenshot({ path: "docs/resultado-mobile.png", fullPage: true });
  await admin.request.post(
    "http://localhost:5180/api/rooms/" + code + "/delete",
    { headers: { Origin: "http://localhost:5180" }, data: {} },
  );
  await admin.close();
  await student.close();
  await second.close();
});
test("diseño responsive sin desbordamientos y entrada táctil", async ({
  page,
}) => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "El conocimiento es tu salida." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: "docs/inicio-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/inicio-mobile.png", fullPage: true });
});

test("señales reales entre compañeros sin alterar puntajes", async ({
  browser,
}) => {
  const origin = "http://localhost:5180",
    admin = await browser.newContext(),
    one = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }),
    two = await browser.newContext();
  const auth = await admin.request.post(origin + "/api/login", {
    headers: { Origin: origin },
    data: { password: password() },
  });
  expect(auth.status()).toBe(200);
  const created = await admin.request.post(origin + "/api/rooms", {
    headers: { Origin: origin },
    data: { title: "Colaboración interactiva", mode: "teams" },
  });
  const { code } = await created.json();
  const joined = await one.request.post(
    origin + "/api/rooms/" + code + "/join",
    {
      headers: { Origin: origin },
      data: { nickname: "Ada equipo", newTeam: "Exploradores", avatar: 2 },
    },
  );
  expect(joined.status()).toBe(201);
  const state = await (
    await one.request.get(origin + "/api/rooms/" + code + "/snapshot")
  ).json();
  await two.request.post(origin + "/api/rooms/" + code + "/join", {
    headers: { Origin: origin },
    data: { nickname: "Emmy equipo", team: state.teams[0].id, avatar: 5 },
  });
  const p = await one.newPage(),
    q = await two.newPage();
  await p.goto(origin + "/jugar/" + code);
  await q.goto(origin + "/jugar/" + code);
  await p.getByRole("button", { name: /Exploradores.*2 exploradores/ }).click();
  await p.getByRole("button", { name: "Tengo una idea", exact: true }).click();
  await expect(q.locator(".team-signal")).toContainText(
    "Ada equipo: Tengo una idea",
  );
  const after = await (
    await two.request.get(origin + "/api/rooms/" + code + "/snapshot")
  ).json();
  expect(after.progress.score).toBe(0);
  expect(after.progress.hints).toBe(0);
  await admin.request.post(origin + "/api/rooms/" + code + "/control", {
    headers: { Origin: origin },
    data: { command: "start" },
  });
  await expect(p.locator(".global-overlay")).toHaveCount(0, { timeout: 10000 });
  await expect(p.locator(".campus-world")).toBeVisible();
  await expect(p.locator(".teammate")).toHaveCount(1);
  await expect(p.locator(".teammate")).toContainText("Emmy equipo");
  await p.getByRole("button", { name: "Abrir controles de la cámara" }).click();
  await expect(p.locator(".protagonist")).toHaveClass(/work/);
  await p.getByRole("button", { name: "Laboratorio", exact: true }).click();
  await p
    .locator(".campus-world")
    .screenshot({ path: "docs/atlas-laboratorio.png" });
  await p.screenshot({ path: "docs/equipo-mobile.png", fullPage: true });
  await admin.request.post(origin + "/api/rooms/" + code + "/delete", {
    headers: { Origin: origin },
    data: {},
  });
  await admin.close();
  await one.close();
  await two.close();
});

test("ingreso solo con apodo y asignación de equipo por administración", async ({
  browser,
}) => {
  const origin = "http://localhost:5180",
    admin = await browser.newContext(),
    student = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
  await admin.request.post(origin + "/api/login", {
    headers: { Origin: origin },
    data: { password: password() },
  });
  const created = await admin.request.post(origin + "/api/rooms", {
    headers: { Origin: origin },
    data: { title: "Apodo y equipo docente", mode: "teams" },
  });
  const { code } = await created.json();
  const page = await student.newPage();
  await page.goto(origin + "/?codigo=" + code);
  await expect(page.getByLabel("Tu apodo")).toBeVisible();
  await expect(page.locator(".join-card input")).toHaveCount(1);
  await expect(page.locator(".join-card select")).toHaveCount(0);
  await page.getByLabel("Tu apodo").fill("Estudiante del curso");
  await page.getByRole("button", { name: "Entrar al laboratorio" }).click();
  await expect(
    page.getByRole("button", { name: "Estoy preparado" }),
  ).toBeVisible();
  const state = await (
    await student.request.get(origin + "/api/rooms/" + code + "/snapshot")
  ).json();
  expect(state.config.duration).toBe(10);
  const premature = await admin.request.post(
    origin + "/api/rooms/" + code + "/control",
    { headers: { Origin: origin }, data: { command: "start" } },
  );
  expect(premature.status()).toBe(400);
  await admin.request.post(origin + "/api/rooms/" + code + "/team", {
    headers: { Origin: origin },
    data: { name: "Equipo del curso" },
  });
  const updated = await (
    await admin.request.get(origin + "/api/rooms/" + code + "/snapshot")
  ).json();
  const assigned = await admin.request.post(
    origin + "/api/rooms/" + code + "/team",
    {
      headers: { Origin: origin },
      data: { playerId: state.you, teamId: updated.teams[0].id },
    },
  );
  expect(assigned.status()).toBe(200);
  await expect(page.locator(".student-toolbar")).toContainText(
    "Equipo del curso",
  );
  const start = await admin.request.post(
    origin + "/api/rooms/" + code + "/control",
    { headers: { Origin: origin }, data: { command: "start" } },
  );
  expect(start.status()).toBe(200);
  const kick = await admin.request.post(
    origin + "/api/rooms/" + code + "/kick",
    { headers: { Origin: origin }, data: { id: state.you } },
  );
  expect(kick.status()).toBe(409);
  await admin.request.post(origin + "/api/rooms/" + code + "/delete", {
    headers: { Origin: origin },
    data: {},
  });
  await admin.close();
  await student.close();
});
