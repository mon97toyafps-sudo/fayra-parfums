/* ============================================================
   Fayra Parfums · Monitor de visitas / carrito / pedido → Discord
   Netlify Function. La URL del webhook vive en la variable de
   entorno DISCORD_WEBHOOK_URL (nunca en el HTML del sitio).

   Tipos de evento (body.type):
     - "visit" (default) → embed de nueva visita + contadores semanales
     - "cart"            → alguien agregó al carrito
     - "order"           → alguien pulsó "Pedir por WhatsApp"
     - "click"           → apretó un botón de la web (sin ruido en Discord)
   ============================================================ */

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const ABACUS = "https://abacus.jasoncameron.dev";
const NS = "fayraparfumsv.netlify.app";

/* Rate limit suave por IP+tipo (la instancia vive poco, alcanza) */
const hits = Object.create(null);

function header(h, nombre) {
  const bajo = nombre.toLowerCase();
  for (const k in h) if (k.toLowerCase() === bajo) return h[k];
  return "";
}

function detectar(ua) {
  const movil = /Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua);
  const tablet = /iPad|Tablet/i.test(ua);
  const device = tablet ? "Tablet 📲" : movil ? "Celular 📱" : "Computadora 💻";

  let os = "Otro";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod|iOS/i.test(ua)) os = "iOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let nav = "Otro";
  if (/Edg\//i.test(ua)) nav = "Edge";
  else if (/OPR|Opera/i.test(ua)) nav = "Opera";
  else if (/Firefox\//i.test(ua)) nav = "Firefox";
  else if (/Chrome\/|CriOS/i.test(ua)) nav = "Chrome";
  else if (/Safari\//i.test(ua)) nav = "Safari";

  return { device, os, nav, movil: movil || tablet };
}

/* Semana ISO actual: ej. 2026-W40 */
function isoWeek() {
  const d = new Date();
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dia + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fday = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - fday + 3);
  const semana = 1 + Math.round((t - first) / (7 * 864e5));
  return t.getUTCFullYear() + "-W" + String(semana).padStart(2, "0");
}

async function hit(key) {
  try { await fetch(ABACUS + "/hit/" + NS + "/" + key); } catch (e) { /* Abacus no disponible */ }
}

exports.handler = async function (event) {
  const h = event.headers || {};
  const ip = header(h, "x-nf-client-connection-ip") || (header(h, "x-forwarded-for").split(",")[0] || "?").trim();
  const pais = header(h, "x-country") || "";
  const region = header(h, "x-region") || "";
  const ciudad = header(h, "x-city") || "";
  const ua = header(h, "user-agent") || "";

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* body vacío */ }

  const type = ["cart", "order", "click"].indexOf(body.type) !== -1 ? body.type : "visit";

  if (!WEBHOOK) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skip: "sin webhook" }) };
  }

  /* Ignora bots y hits repetidos (los pedidos no se limitan: son la cosa importante) */
  if (/bot|crawler|spider|curl|wget/i.test(ua)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skip: "bot" }) };
  }
  const ahora = Date.now();
  const intervalo = type === "visit" ? 20000 : type === "cart" ? 8000 : type === "click" ? 4000 : 0;
  const clave = ip + "|" + type;
  if (intervalo && hits[clave] && ahora - hits[clave] < intervalo) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skip: "repetido" }) };
  }
  hits[clave] = ahora;

  /* Los clics solo se cuentan: no ensucian el canal de Discord */
  if (type === "click") {
    const origen = String(body.source || "otro").slice(0, 24);
    await hit("clic-" + origen);
    return { statusCode: 200, body: JSON.stringify({ ok: true, counted: origen }) };
  }

  const d = detectar(ua);
  const ubicacion = [ciudad, region, pais].filter(Boolean).join(", ") || "—";
  const pagina = body.path || "/";
  const base = [
    { name: "📍 Ubicación", value: ubicacion, inline: true },
    { name: "🌐 IP", value: "`" + ip + "`", inline: true },
    { name: "💻 Equipo", value: d.device + " · " + d.os + " · " + d.nav, inline: false }
  ];

  let embed;
  if (type === "cart") {
    embed = {
      title: "🛒 Agregaron al carrito",
      color: 0xc9a35c,
      fields: [
        { name: "Producto", value: "```" + (body.detail || "—") + "```", inline: false },
        { name: "💳 Total en carrito", value: body.total || "—", inline: true }
      ].concat(base),
      footer: { text: "Fayra Parfums · Carrito" },
      timestamp: new Date().toISOString()
    };
  } else if (type === "order") {
    embed = {
      title: "🚨 ¡Pedido por WhatsApp!",
      color: 0x25d366,
      fields: [
        { name: "🧾 Pedido", value: "```" + (body.detail || "—") + "```", inline: false },
        { name: "Entró desde", value: body.source || "—", inline: true }
      ].concat(base),
      footer: { text: "Fayra Parfums · ¡Lead caliente!" },
      timestamp: new Date().toISOString()
    };
  } else {
    embed = {
      title: "🛍️ Nueva visita a Fayra Parfums",
      color: 0xc9a35c,
      fields: [
        { name: "Dispositivo", value: d.device + " · " + d.os + " · " + d.nav, inline: false },
        { name: "📍 Ubicación", value: ubicacion, inline: true },
        { name: "🌐 IP", value: "`" + ip + "`", inline: true },
        { name: "📄 Página", value: "```" + pagina + "```", inline: false },
        { name: "🔗 Vino de", value: body.ref || "Directo (escribió la URL)", inline: false }
      ],
      footer: { text: "Fayra Parfums · Monitor de visitas" },
      timestamp: new Date().toISOString()
    };

    /* Contadores para el resumen semanal (solo visitas reales) */
    const wk = isoWeek();
    await Promise.all([
      hit("sem-" + wk + "-visitas"),
      hit("sem-" + wk + (d.movil ? "-movil" : "-pc"))
    ]);
  }

  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Fayra Monitor", embeds: [embed] })
    });
  } catch (e) {
    /* Si Discord falla, el sitio sigue funcionando igual */
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
