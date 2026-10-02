/* ============================================================
   Fayra Parfums · Resumen semanal → Discord
   Netlify Function programada (cada lunes 9am El Salvador).
   Lee los contadores de Abacus (semana actual) y publica un
   embed con las visitas de la semana y el total histórico.
   Se puede disparar a mano: /.netlify/functions/weekly
   ============================================================ */

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const ABACUS = "https://abacus.jasoncameron.dev";
const NS = "fayraparfumsv.netlify.app";

let ultimoEnvio = 0; /* evita spam si alguien llama la función a mano */

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

async function get(key) {
  try {
    const r = await fetch(ABACUS + "/get/" + NS + "/" + key);
    if (!r.ok) return 0;
    const j = await r.json();
    return Number(j.value) || 0;
  } catch (e) {
    return 0;
  }
}

exports.handler = async function () {
  if (!WEBHOOK) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skip: "sin webhook" }) };
  }

  const ahora = Date.now();
  if (ahora - ultimoEnvio < 6 * 60 * 60 * 1000) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skip: "cooldown" }) };
  }
  ultimoEnvio = ahora;

  const wk = isoWeek();
  const datos = await Promise.all([
    get("sem-" + wk + "-visitas"),
    get("sem-" + wk + "-pc"),
    get("sem-" + wk + "-movil"),
    get("visitas"),
    /* Qué botones están convirtiendo (contadores acumulados) */
    get("clic-whatsapp-texto"),
    get("clic-carrito-whatsapp"),
    get("clic-flotante"),
    get("clic-agregar-carrito"),
    get("clic-ver-producto"),
    get("clic-instagram"),
    get("clic-compartir")
  ]);

  /* Ordena los botones de mayor a menor para ver de un vistazo cuál vende */
  const botones = [
    ["💬 Botón de WhatsApp del catálogo", datos[4]],
    ["🛒 Enviar pedido desde el carrito", datos[5]],
    ["🟢 Botón flotante de WhatsApp", datos[6]],
    ["➕ Agregar al carrito", datos[7]],
    ["👁️ Ver detalle del producto", datos[8]],
    ["📸 Instagram", datos[9]],
    ["🔗 Compartir la tienda", datos[10]]
  ].sort(function (a, b) { return b[1] - a[1]; });

  const lineas = botones
    .filter(function (b) { return b[1] > 0; })
    .map(function (b) { return b[0] + ": **" + b[1] + "**"; })
    .join("\n");

  const embed = {
    title: "📊 Resumen semanal de Fayra Parfums",
    color: 0xc9a35c,
    description: "**Semana " + wk + "** (se reinicia cada lunes)",
    fields: [
      { name: "👁️ Visitas esta semana", value: "```" + datos[0] + "```", inline: true },
      { name: "🏛️ Computadoras", value: "```" + datos[1] + "```", inline: true },
      { name: "📱 Celulares y tablets", value: "```" + datos[2] + "```", inline: true },
      { name: "👑 Total histórico de visitas", value: "```" + datos[3] + "```", inline: false }
    ].concat(lineas ? [{ name: "🎯 Clicks por botón (histórico)", value: lineas, inline: false }] : []),
    footer: { text: "Fayra Parfums · Reporte automático (lunes 9am)" },
    timestamp: new Date().toISOString()
  };

  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Fayra Reportes", embeds: [embed] })
    });
  } catch (e) { /* Discord no disponible */ }

  return { statusCode: 200, body: JSON.stringify({ ok: true, semana: wk }) };
};
