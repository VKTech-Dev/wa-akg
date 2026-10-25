// Validação visual barata da maquete do WA-AKG (vk-fork-notes/design/Maquete Html-Tailwind).
// Abre as páginas no Chrome real (sem tela), mede problemas por script e compara com a última versão aprovada.
// Só devolve texto curto; imagens ficam em disco e só são lidas quando algo mudou.
//
//   node vk-fork-notes/design/ferramentas/validar-visual.mjs                    # audita e compara com a base aprovada
//   node vk-fork-notes/design/ferramentas/validar-visual.mjs --pagina dashboard # só uma página
//   node vk-fork-notes/design/ferramentas/validar-visual.mjs --tema claro       # tema claro (padrão: escuro)
//   node vk-fork-notes/design/ferramentas/validar-visual.mjs --aceitar          # grava o estado atual como base aprovada
//
// Saída em <tmp>/wa-akg-validacao (ou --saida): atual/ (png), ver/ (jpg leve + montagem.jpg), base/ (aprovado).
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const proto = join(aqui, "..", "Maquete Html-Tailwind");
const arg = (n, pad) => { const i = process.argv.indexOf("--" + n); return i < 0 ? pad : (process.argv[i + 1]?.startsWith("--") || i + 1 >= process.argv.length ? true : process.argv[i + 1]); };
const saida = arg("saida", join(tmpdir(), "wa-akg-validacao"));
const tema = arg("tema", "escuro") === "claro" ? "light" : "dark";
const paginas = String(arg("pagina", "index")).split(",");
const aceitar = arg("aceitar", false) === true;
const CHROME = process.env.CHROME_PATH || (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "/usr/bin/google-chrome");
const PORTA = 9333 + Math.floor(Math.random() * 500);
const telas = [{ nome: "desktop", w: 1440, h: 900, mobile: false }, { nome: "celular", w: 390, h: 844, mobile: true }];
for (const d of ["atual", "ver", "base"]) mkdirSync(join(saida, d), { recursive: true });

// ---------- auditoria que roda dentro da página ----------
const AUDITORIA = `(() => {
  const vw = innerWidth, out = {};
  const sel = (e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\\s+/).slice(0, 2).join(".") : "");
  const visivel = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05; };
  const emRolagem = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return true; } return false; };
  out.overflowPagina = document.documentElement.scrollWidth > vw + 1;
  out.foraDaTela = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return visivel(e) && r.right > vw + 1 && !emRolagem(e) && getComputedStyle(e).position !== "fixed"; }).slice(0, 5).map(sel);
  out.textoCortado = [...document.querySelectorAll("body *")].filter((e) => visivel(e) && e.getBoundingClientRect().width > 2 && e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== "ellipsis" && getComputedStyle(e).overflowX === "hidden").slice(0, 5).map(sel);
  // contraste
  const cor = (c) => { let m = c.match(/^rgba?\\(([^)]+)\\)/); if (m) { const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; }
    m = c.match(/^color\\(srgb ([^)]+)\\)/); if (m) { const p = m[1].split(/[ \\/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p[3] ?? 1 }; } return null; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const sobre = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const fundo = (e) => { const camadas = []; for (let p = e; p; p = p.parentElement) { const s = getComputedStyle(p); if (/gradient/.test(s.backgroundImage) && p !== document.body && p !== document.documentElement) return null; const c = cor(s.backgroundColor); if (c && c.a > 0) { camadas.push(c); if (c.a >= 1) break; } }
    let base = { r: 255, g: 255, b: 255, a: 1 }; for (const c of camadas.reverse()) base = sobre(c, base); return base; };
  const falhas = new Map(); let verificados = 0;
  for (const e of document.querySelectorAll("body *")) {
    if (!visivel(e) || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e), f = cor(s.color), b = fundo(e); if (!f || !b) continue; verificados++;
    const fg = f.a < 1 ? sobre(f, b) : f, l1 = lum(fg), l2 = lum(b), r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const tam = parseFloat(s.fontSize), grande = tam >= 24 || (tam >= 18.66 && +s.fontWeight >= 700), min = grande ? 3 : 4.5;
    if (r < min) { const k = sel(e) + "|" + s.color + "|" + s.backgroundColor; if (!falhas.has(k)) falhas.set(k, { el: sel(e), razao: +r.toFixed(2), minimo: min, texto: e.textContent.trim().slice(0, 28) }); }
  }
  out.contraste = { verificados, falhas: [...falhas.values()].slice(0, 6), total: falhas.size };
  // alvos de toque (celular) e acessibilidade básica
  out.alvosPequenos = vw < 600 ? [...document.querySelectorAll("a,button,select,input:not([type=checkbox])")].filter((e) => visivel(e) && (e.getBoundingClientRect().width < 32 || e.getBoundingClientRect().height < 40) && !(e.tagName === "A" && e.closest("p,li,td"))).slice(0, 5).map((e) => { const r = e.getBoundingClientRect(); return sel(e) + " [" + (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 14) + "] " + Math.round(r.width) + "x" + Math.round(r.height); }) : [];
  const nome = (e) => (e.getAttribute("aria-label") || e.getAttribute("title") || e.textContent || "").trim();
  out.semNome = [...document.querySelectorAll("button,a[href]")].filter((e) => !nome(e) && !e.querySelector("[aria-label]")).slice(0, 5).map(sel);
  out.inputsSemRotulo = [...document.querySelectorAll("input,select")].filter((e) => !e.getAttribute("aria-label") && !e.closest("label") && !(e.id && document.querySelector('label[for="' + e.id + '"]'))).slice(0, 5).map(sel);
  out.imgSemAlt = [...document.querySelectorAll("img:not([alt])")].length;
  out.h1 = document.querySelectorAll("h1").length;
  out.lang = document.documentElement.lang || "";
  out.graficosSemTexto = [...document.querySelectorAll("svg.graf")].filter((s) => !s.getAttribute("aria-label")).length;
  return out;
})()`;

// ---------- CDP mínimo ----------
const chromeDir = mkdtempSync(join(tmpdir(), "wa-akg-chrome-"));
const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${PORTA}`, "--remote-allow-origins=*", `--user-data-dir=${chromeDir}`, "about:blank"], { stdio: "ignore" });
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(), ouvintes = [];
async function conectar() {
  for (let i = 0; i < 60; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json();
      const pg = lista.find((t) => t.type === "page");
      if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; }); break; }
    } catch { /* ainda subindo */ }
    await dorme(250);
  }
  if (!ws) throw new Error("Não consegui conectar ao Chrome (porta " + PORTA + ").");
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const [ok, no] = pend.get(d.id); pend.delete(d.id); d.error ? no(new Error(d.error.message)) : ok(d.result); } else ouvintes.forEach((f) => f(d)); };
}
const envia = (method, params = {}) => new Promise((ok, no) => { const i = ++id; pend.set(i, [ok, no]); ws.send(JSON.stringify({ id: i, method, params })); });
const espera = (evento, ms = 15000) => new Promise((ok) => { const t = setTimeout(() => ok(false), ms); const f = (d) => { if (d.method === evento) { clearTimeout(t); ouvintes.splice(ouvintes.indexOf(f), 1); ok(true); } }; ouvintes.push(f); });
const py = (obj) => { const r = spawnSync(process.platform === "win32" ? "python" : "python3", ["-P", join(aqui, "imagens.py")], { input: JSON.stringify(obj), encoding: "utf8" }); if (r.status !== 0) throw new Error(r.stderr); return JSON.parse(r.stdout); };

// ---------- execução ----------
const relatorio = [], paraVer = [];
try {
  await conectar();
  await envia("Page.enable"); await envia("Runtime.enable"); await envia("Log.enable");
  let erros = [], idTema = null;
  ouvintes.push((d) => {
    if (d.method === "Runtime.exceptionThrown") erros.push("exceção: " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split("\n")[0]);
    if (d.method === "Log.entryAdded" && d.params.entry.level === "error" && !/fonts\.g(static|oogleapis)/.test(d.params.entry.url || "") ) erros.push("log: " + d.params.entry.text.slice(0, 90));
  });
  for (const p of paginas) for (const t of telas) {
    const nome = `${p}-${t.nome}-${tema === "dark" ? "escuro" : "claro"}`;
    erros = [];
    await envia("Emulation.setDeviceMetricsOverride", { width: t.w, height: t.h, deviceScaleFactor: 1, mobile: t.mobile });
    await envia("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }, { name: "prefers-color-scheme", value: tema }] });
    // O app.js lê só o localStorage (vk-theme), não o prefers-color-scheme: sem isto o "claro" renderiza escuro.
    if (idTema) await envia("Page.removeScriptToEvaluateOnNewDocument", { identifier: idTema });
    idTema = (await envia("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem('vk-theme','${tema}')}catch(e){}` })).identifier;
    const carregou = espera("Page.loadEventFired");
    await envia("Page.navigate", { url: pathToFileURL(join(proto, p + ".html")).href });
    await carregou;
    await envia("Runtime.evaluate", { expression: "document.fonts.ready.then(()=>true)", awaitPromise: true });
    await dorme(300);
    const { result } = await envia("Runtime.evaluate", { expression: AUDITORIA, returnByValue: true });
    const a = result.value;
    const m = await envia("Page.getLayoutMetrics");
    const H = Math.ceil(m.cssContentSize.height), W = Math.ceil(m.cssContentSize.width);
    const png = await envia("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    const arqAtual = join(saida, "atual", nome + ".png"); writeFileSync(arqAtual, Buffer.from(png.data, "base64"));
    const jpg = await envia("Page.captureScreenshot", { format: "jpeg", quality: 55, captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: H, scale: t.mobile ? 0.6 : 0.5 } });
    const arqVer = join(saida, "ver", nome + ".jpg"); writeFileSync(arqVer, Buffer.from(jpg.data, "base64"));
    const arqBase = join(saida, "base", nome + ".png");
    let mudou = "novo (sem base)";
    if (existsSync(arqBase)) { const d = py({ cmd: "diff", a: arqBase, b: arqAtual }); mudou = d.pct < 0.05 ? "igual" : `mudou ${d.pct}% dos pixels${d.tamanho ? " (tamanho diferente)" : ""}`; }
    if (aceitar) copyFileSync(arqAtual, arqBase);
    const problemas = [], avisos = [];
    if (a.overflowPagina) problemas.push("rolagem horizontal na página");
    if (a.foraDaTela.length) problemas.push("fora da tela: " + a.foraDaTela.join(", "));
    if (a.textoCortado.length) problemas.push("texto cortado: " + a.textoCortado.join(", "));
    if (a.contraste.total) problemas.push(`contraste (${a.contraste.total}): ` + a.contraste.falhas.map((f) => `${f.el} "${f.texto}" ${f.razao}<${f.minimo}`).join("; "));
    if (a.alvosPequenos.length) avisos.push("alvos de toque (altura < 40px ou largura < 32px): " + a.alvosPequenos.join(", "));
    if (a.semNome.length) problemas.push("sem nome acessível: " + a.semNome.join(", "));
    if (a.inputsSemRotulo.length) problemas.push("campos sem rótulo: " + a.inputsSemRotulo.join(", "));
    if (a.imgSemAlt) problemas.push(a.imgSemAlt + " imagem(ns) sem alt");
    if (a.h1 !== 1) problemas.push(`${a.h1} <h1>`);
    if (!a.lang) problemas.push("sem lang");
    if (a.graficosSemTexto) problemas.push(a.graficosSemTexto + " gráfico(s) sem texto alternativo");
    if (erros.length) problemas.push("console: " + [...new Set(erros)].slice(0, 3).join(" | "));
    relatorio.push({ nome, mudou, problemas, avisos, tam: `${W}x${H}`, verificados: a.contraste.verificados });
    if (!mudou.startsWith("igual") || problemas.length || avisos.length) paraVer.push({ arq: arqVer, rotulo: nome });
  }
} finally {
  try { ws?.close(); } catch {}
  proc.kill();
  await dorme(400);
  try { rmSync(chromeDir, { recursive: true, force: true }); } catch {}
}

// ---------- relatório ----------
let comProblema = 0;
for (const r of relatorio) {
  const ok = r.problemas.length === 0;
  if (!ok) comProblema++;
  console.log(`${ok ? (r.avisos.length ? "AVISO " : "OK    ") : "FALHA "} ${r.nome.padEnd(30)} ${r.tam.padEnd(10)} ${r.mudou}`);
  r.problemas.forEach((p) => console.log("         - " + p));
  r.avisos.forEach((p) => console.log("         ~ " + p));
}
if (paraVer.length) { const m = py({ cmd: "montagem", itens: paraVer, saida: join(saida, "ver", "montagem.jpg") }); console.log(`\nPara olhar (${paraVer.length} tela(s) que mudaram ou têm problema): ${m.saida}`); }
else console.log("\nNada mudou e nada falhou: não precisa olhar imagem.");
if (aceitar) console.log("Base aprovada atualizada.");
console.log(`Telas: ${relatorio.length} | com problema: ${comProblema} | saída: ${saida}`);
process.exit(comProblema ? 1 : 0);
