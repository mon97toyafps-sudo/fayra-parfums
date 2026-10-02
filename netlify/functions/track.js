/* ============================================================
   Fayra Parfums · Monitor de visitas → Discord
   Netlify Function. La URL del webhook vive en la variable de
   entorno DISCORD_WEBHOOK_URL (nunca en el HTML del sitio).
   ============================================================ */

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

/* Rate limit suave por IP (la instancia vive poco, alcanza) */
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

  return { device, os, nav };
}

exports.handler = async function (event) {
  if (!WEBHOOK) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skip: "sin webhook" }) };
  }

  const h = event.headers || {};
  const ip = header(h, "x-nf-client-connection-ip") || header(h, "x-forwarded-for").split(",")[0] || "?";
  const pais = header(h, "x-country") || "";
  const region = header(h, "x-region") || "";
  const ciudad = header(h, "x-city") || "";
  const ua = header(h, "user-agent") || "";

  /* Ignora bots/crawlers y hits repetidos */
  if (/bot|crawler|spider|curl|wget/i.test(ua)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skip: "bot" }) };
  }
  const ahora = Date.now();
  if (hits[ip] && ahora - hits[ip] < 20000) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skip: "repetido" }) };
  }
  hits[ip] = ahora;

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* body vacío */ }

  const d = detectar(ua);
  const ubicacion = [ciudad, region, pais].filter(Boolean).join(", ") || "—";
  const pagina = body.path || "/";

  const embed = {
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
