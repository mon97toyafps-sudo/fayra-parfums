/* ============================================================
   Fayra Parfums · PANEL PRIVADO DENTRO DE DISCORD
   Netlify Function que recibe las "interacciones" de Discord.

   Por qué así: no hay bot corriendo 24/7 y no hay ninguna página
   privada en la web. Discord firma cada pedido con su clave privada
   y acá se verifica con la clave pública (DISCORD_PUBLIC_KEY). Un
   POST sin firma válida se rechaza antes de tocar ningún dato.

   Las respuestas van efímeras (flags 64): solo las ve quien escribe
   el comando, no quedan en el historial del canal.

   Variables de entorno necesarias:
     DISCORD_PUBLIC_KEY     clave pública de la aplicación (hex)
     DISCORD_ALLOW_USERS    (opcional) ids de Discord separados por coma
     NETLIFY_SITE_ID        para leer Blobs
     NETLIFY_BLOBS_TOKEN    para leer Blobs

   Comandos: /stats  /hoy  /online
   ============================================================ */

const crypto = require("crypto");

const PUBLIC_KEY = (process.env.DISCORD_PUBLIC_KEY || "").trim();
const PERMITIDOS = (process.env.DISCORD_ALLOW_USERS || "")
  .split(/[,\s]+/)
  .filter(Boolean);

const ABACUS = "https://abacus.jasoncameron.dev";
const NS = "fayraparfumsv.netlify.app";
const EFIMERO = 64;              /* solo lo ve quien pidió el comando */
const TTL_ONLINE = 100000;       /* igual que registro.js: 100 s sin ping = salió */
const LIMITE_MS = 2300;          /* Discord corta a los 3 s: respondemos antes */

/* Los clics que manda app.js, para el desglose */
const CLICS = [
  "whatsapp-texto",
  "flotante",
  "agregar-carrito",
  "carrito-whatsapp",
  "ver-producto",
  "compartir",
  "instagram"
];

let store = null;

/* ------------------------------------------------------------ helpers --- */

function header(h, nombre) {
  const bajo = nombre.toLowerCase();
  for (const k in h) if (k.toLowerCase() === bajo) return h[k];
  return "";
}

/* Netlify puede mandar el body en base64; la firma va sobre los bytes
   exactos que mandó Discord, así que hay que recuperarlos tal cual. */
function cuerpoCrudo(event) {
  const b = event.body || "";
  return event.isBase64Encoded
    ? Buffer.from(b, "base64")
    : Buffer.from(b, "utf8");
}

/* Ed25519. Discord da la clave como 32 bytes en hex; para usarla con
   Node hay que envolverla en el encabezado DER de una SPKI. */
const DER_ED25519 = Buffer.from("302a300506032b6570032100", "hex");

function firmaValida(event, bytes) {
  const h = event.headers || {};
  const firma = header(h, "x-signature-ed25519");
  const sello = header(h, "x-signature-timestamp");
  if (!PUBLIC_KEY || !firma || !sello) return false;

  try {
    const der = Buffer.concat([DER_ED25519, Buffer.from(PUBLIC_KEY, "hex")]);
    const clave = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
    return crypto.verify(
      null,
      Buffer.concat([Buffer.from(sello, "utf8"), bytes]),
      clave,
      Buffer.from(firma, "hex")
    );
  } catch (e) {
    return false;
  }
}

function responder(obj) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  };
}

/* Respuesta efímera de texto */
function aviso(texto) {
  return responder({ type: 4, data: { content: texto, flags: EFIMERO } });
}

/* Respuesta efímera con tarjeta */
function tarjeta(embed) {
  return responder({ type: 4, data: { embeds: [embed], flags: EFIMERO } });
}

function conLimite(promesa, ms, porDefecto) {
  return Promise.race([
    promesa,
    new Promise(function (listo) { setTimeout(function () { listo(porDefecto); }, ms); })
  ]);
}

/* ------------------------------------------------------------- fuentes --- */

async function abrirStore() {
  if (!store) {
    const b = await import("@netlify/blobs");
    const siteID = process.env.NETLIFY_SITE_ID || "";
    const token = process.env.NETLIFY_BLOBS_TOKEN || "";
    store = siteID && token
      ? b.getStore({ name: "fayra", siteID, token })
      : b.getStore("fayra");
  }
  return store;
}

async function leer(clave) {
  try {
    const s = await abrirStore();
    return await s.get(clave, { type: "json" });
  } catch (e) {
    return null;
  }
}

async function contador(clave) {
  try {
    const r = await fetch(ABACUS + "/get/" + NS + "/" + clave, {
      headers: { "cache-control": "no-cache" }
    });
    if (!r.ok) return 0;
    const j = await r.json();
    return Number(j.value) || 0;
  } catch (e) {
    return 0;
  }
}

function isoWeek() {
  const d = new Date();
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dia + 3);
  const primero = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const pdia = (primero.getUTCDay() + 6) % 7;
  primero.setUTCDate(primero.getUTCDate() - pdia + 3);
  const semana = 1 + Math.round((t - primero) / (7 * 864e5));
  return t.getUTCFullYear() + "-W" + String(semana).padStart(2, "0");
}

/* El Salvador es UTC-6: con la fecha en UTC el "hoy" cambiaba a las 6 de la
   tarde y /hoy mostraba ceros. Tiene que coincidir con track.js. */
function hoyISO() {
  /* Resta fija de 6 horas: El Salvador no tiene horario de verano. Sin
     depender de zonas horarias ni del formato del locale. */
  return new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
}

function miles(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* ----------------------------------------------------------- comandos --- */

async function cmdStats() {
  const wk = isoWeek();
  const claves = ["sem-" + wk + "-visitas", "sem-" + wk + "-movil", "sem-" + wk + "-pc"];
  const conClics = claves.concat(CLICS.map(function (c) { return "clic-" + c; }));

  const datos = await conLimite(
    Promise.all(conClics.map(contador)),
    LIMITE_MS,
    conClics.map(function () { return 0; })
  );

  const visitas = datos[0], movil = datos[1], pc = datos[2];
  const clic = {};
  CLICS.forEach(function (c, i) { clic[c] = datos[3 + i] || 0; });

  const totalClics = CLICS.reduce(function (s, c) { return s + clic[c]; }, 0);
  const aWhats = (clic["whatsapp-texto"] || 0) + (clic["flotante"] || 0) + (clic["carrito-whatsapp"] || 0);
  const alCarrito = clic["agregar-carrito"] || 0;
  const vieron = clic["ver-producto"] || 0;

  return tarjeta({
    title: "📊 Semana " + wk,
    color: 0x111111,
    fields: [
      { name: "👀 Visitas", value: miles(visitas), inline: true },
      { name: "📱 Celular", value: miles(movil), inline: true },
      { name: "💻 Computadora", value: miles(pc), inline: true },
      { name: "👆 Clics en total", value: miles(totalClics), inline: true },
      { name: "🛒 Al carrito", value: miles(alCarrito), inline: true },
      { name: "💬 A WhatsApp", value: miles(aWhats), inline: true },
      { name: "🔍 Vieron un producto", value: miles(vieron), inline: true }
    ],
    footer: { text: "Fayra Parfums · solo vos ves este mensaje" },
    timestamp: new Date().toISOString()
  });
}

async function cmdHoy() {
  const dia = hoyISO();

  /* Dos fuentes en paralelo, y con lo que conteste cada una se arma la
     tarjeta:
       Abacus → contadores del día (no necesita credenciales, siempre anda)
       Blobs  → de dónde vienen y qué páginas (si está configurado) */
  const claves = [
    "dia-" + dia + "-v",
    "dia-" + dia + "-c",
    "dia-" + dia + "-o",
    "dia-" + dia + "-movil",
    "dia-" + dia + "-pc",
    "dia-" + dia + "-carrito"
  ];

  const [cuenta, m] = await Promise.all([
    conLimite(Promise.all(claves.map(contador)), LIMITE_MS, claves.map(function () { return 0; })),
    conLimite(leer("metricas"), LIMITE_MS, null)
  ]);

  const d = m && m.dias && m.dias[dia] ? m.dias[dia] : null;
  const visitas = d ? d.v || 0 : cuenta[0];
  const clics = d ? d.c || 0 : cuenta[1];
  const pedidos = d ? d.o || 0 : cuenta[2];

  const campos = [
    { name: "👀 Visitas", value: miles(visitas), inline: true },
    { name: "👆 Clics", value: miles(clics), inline: true },
    { name: "🧾 Pedidos", value: miles(pedidos), inline: true },
    { name: "📱 Celular", value: miles(cuenta[3]), inline: true },
    { name: "💻 Computadora", value: miles(cuenta[4]), inline: true },
    { name: "🛒 Al carrito", value: miles(cuenta[5]), inline: true }
  ];

  if (m) {
    const fuentes = Object.keys(m.fuentes || {})
      .map(function (k) { return [k, m.fuentes[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 6)
      .map(function (p) { return "• " + p[0] + " — " + miles(p[1]); })
      .join("\n");

    const paginas = Object.keys(m.paginas || {})
      .map(function (k) { return [k, m.paginas[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 4)
      .map(function (p) { return "• " + p[0] + " — " + miles(p[1]); })
      .join("\n");

    if (fuentes) campos.push({ name: "🔗 De dónde vienen (histórico)", value: fuentes, inline: false });
    if (paginas) campos.push({ name: "📄 Páginas más vistas (histórico)", value: paginas, inline: false });
    campos.push({ name: "📈 Total histórico", value: miles(m.total || 0), inline: true });
  }

  return tarjeta({
    title: "📅 Hoy · " + dia,
    color: 0x111111,
    fields: campos,
    footer: { text: "Fayra Parfums · solo vos ves este mensaje" },
    timestamp: new Date().toISOString()
  });
}

async function cmdOnline() {
  const o = await conLimite(leer("online"), LIMITE_MS, null);
  if (!o) {
    return aviso(
      "No pude leer quién está conectado.\n" +
      "Faltan las variables **NETLIFY_SITE_ID** y **NETLIFY_BLOBS_TOKEN** en Netlify."
    );
  }

  const ahora = Date.now();
  const gente = Object.keys(o)
    .map(function (k) { return o[k]; })
    .filter(function (x) { return x && ahora - (x.visto || 0) <= TTL_ONLINE; });

  if (!gente.length) return aviso("Ahora mismo no hay nadie en el sitio.");

  const lineas = gente.slice(0, 20).map(function (x) {
    const lugar = [x.ciudad, x.pais].filter(Boolean).join(", ") || "—";
    const equipo = x.dispositivo || "?";
    const pagina = x.pagina || "/";
    return "• **" + lugar + "** · " + equipo + " · `" + pagina + "`";
  }).join("\n");

  return tarjeta({
    title: "🟢 Ahora en el sitio: " + gente.length,
    description: lineas.slice(0, 4000),
    color: 0x25d366,
    footer: { text: "Se actualiza cada vez que corrés el comando" },
    timestamp: new Date().toISOString()
  });
}

/* -------------------------------------------------------------- handler --- */

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "solo POST" };
  }

  const bytes = cuerpoCrudo(event);

  if (!firmaValida(event, bytes)) {
    return { statusCode: 401, body: "firma inválida" };
  }

  let inter = {};
  try {
    inter = JSON.parse(bytes.toString("utf8"));
  } catch (e) {
    return { statusCode: 400, body: "json inválido" };
  }

  /* 1 = Discord probando el endpoint desde el portal. Hay que contestar igual. */
  if (inter.type === 1) return responder({ type: 1 });

  if (inter.type !== 2) return aviso("Por ahora solo entiendo comandos.");

  const usuario =
    (inter.member && inter.member.user && inter.member.user.id) ||
    (inter.user && inter.user.id) ||
    "";

  if (PERMITIDOS.length && PERMITIDOS.indexOf(usuario) === -1) {
    return aviso("No estás autorizado a usar este panel.");
  }

  const nombre = (inter.data && inter.data.name) || "";

  try {
    if (nombre === "stats") return await cmdStats();
    if (nombre === "hoy") return await cmdHoy();
    if (nombre === "online") return await cmdOnline();
    return aviso("No conozco el comando `/" + nombre + "`.");
  } catch (e) {
    return aviso("No pude leer los datos ahora mismo. Probá de nuevo en un rato.");
  }
};
