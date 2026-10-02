/* ============================================================
   Fayra Parfums · Panel "viendo ahora" → Discord
   Netlify Function. Los visitantes hacen ping cada 30s con un
   id de sesión; esta función mantiene el listado vivo y EDITA
   un mensaje fijo en Discord (el "panel").
   ============================================================ */

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const TTL = 80000;          /* sin ping en 80s → se da por fuera */
const MIN_EDIT = 2500;      /* máximo un edit a Discord cada 2.5s */

const visitantes = Object.create(null); /* sid -> {ip, pais, device, pagina, visto} */
const limites = Object.create(null);    /* ip -> ultimo hit */
let panelId = null;
let ultimaEdicion = 0;

function header(h, nombre) {
  const bajo = nombre.toLowerCase();
  for (const k in h) if (k.toLowerCase() === bajo) return h[k];
  return "";
}

function detectar(ua) {
  if (/iPad|Tablet/i.test(ua)) return "Tablet 📲";
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) return "Celular 📱";
  return "Computadora 💻";
}

function armarPanel(n) {
  const lista = Object.keys(visitantes);
  const campos = lista.slice(0, 12).map(function (sid, i) {
    const v = visitantes[sid];
    return {
      name: "#" + (i + 1) + " · " + (v.pais || "—"),
      value: v.device + " · `" + v.pagina + "`",
      inline: true
    };
  });

  return {
    title: "👥 Fayra en vivo — " + n + (n === 1 ? " persona viendo ahora" : " personas viendo ahora"),
    color: n > 0 ? 0xc9a35c : 0x555555,
    fields: n > 0 ? campos : [{ name: "Estado", value: "Nadie en línea en este momento", inline: false }],
    footer: { text: "Se actualiza solo cada ~30 segundos" },
    timestamp: new Date().toISOString()
  };
}

async function publicarPanel(n) {
  const payload = { username: "Fayra Panel", embeds: [armarPanel(n)] };

  if (!panelId) {
    /* Primer ping del instancia: creamos el mensaje y guardamos su id */
    const r = await fetch(WEBHOOK + "?wait=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const msg = await r.json();
    panelId = msg && msg.id;
    return;
  }

  await fetch(WEBHOOK + "/messages/" + panelId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

exports.handler = async function (event) {
  if (!WEBHOOK) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skip: "sin webhook" }) };
  }

  const h = event.headers || {};
  const ua = header(h, "user-agent") || "";
  if (/bot|crawler|spider|curl|wget/i.test(ua)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skip: "bot" }) };
  }

  const ip = header(h, "x-nf-client-connection-ip") || "?";
  const ahora = Date.now();

  /* Un ping por IP cada 10s (varias pestañas = un solo visitante) */
  if (limites[ip] && ahora - limites[ip] < 10000) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skip: "caliente" }) };
  }
  limites[ip] = ahora;

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* vacío */ }
  const sid = String(body.sid || ip).slice(0, 64);

  visitantes[sid] = {
    ip: ip,
    pais: header(h, "x-country") || "—",
    device: detectar(ua),
    pagina: String(body.path || "/").slice(0, 40),
    visto: ahora
  };

  /* Podar a los que se fueron */
  Object.keys(visitantes).forEach(function (k) {
    if (ahora - visitantes[k].visto > TTL) delete visitantes[k];
  });

  const n = Object.keys(visitantes).length;

  /* Throttle: solo publicamos si pasó un rato desde el último edit */
  if (ahora - ultimaEdicion >= MIN_EDIT) {
    ultimaEdicion = ahora;
    try { await publicarPanel(n); } catch (e) { /* Discord no disponible */ }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, online: n }) };
};
