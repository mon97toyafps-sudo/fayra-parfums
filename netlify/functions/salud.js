/* ============================================================
   Fayra Parfums · Diagnóstico del sitio (solo informa, no avisa)
   Netlify Function normal: se puede abrir desde el navegador para
   ver el estado real de la tienda.

     /.netlify/functions/salud

   Revisa tres cosas y no cuenta ninguna visita:
     1. que el sitio cargue y siga siendo la tienda
     2. que la función de registro contesté (type: "ping")
     3. que Abacus, de donde salen /stats y /hoy, responda

   NO manda nada a Discord a propósito: si lo hiciera, cualquiera que
   abra la URL podría llenar el canal de alertas. De eso se encarga
   latido.js, que corre solo por el schedule de Netlify.
   ============================================================ */

const SITIO = "https://fayraparfumsv.netlify.app";
const ABACUS = "https://abacus.jasoncameron.dev";
const NS = "fayraparfumsv.netlify.app";
const SONDEO_MS = 8000;

const CANALES = [
  ["DISCORD_WEBHOOK_URL", "general (respaldo)"],
  ["DISCORD_WEBHOOK_VENTAS", "ventas"],
  ["DISCORD_WEBHOOK_TRAFICO", "tráfico"],
  ["DISCORD_WEBHOOK_ALERTAS", "alertas"],
  ["DISCORD_PUBLIC_KEY", "panel de Discord"]
];

function faltan() {
  return CANALES.filter(function (c) { return !process.env[c[0]]; })
    .map(function (c) { return c[1]; });
}

async function sondear(url, opciones) {
  try {
    const r = await fetch(url, Object.assign(
      { signal: AbortSignal.timeout(SONDEO_MS) },
      opciones || {}
    ));
    return { ok: r.ok, status: r.status, respuesta: r };
  } catch (e) {
    return { ok: false, status: 0, error: e.message || "sin respuesta" };
  }
}

/* Devuelve { problemas, detalle }. Lo usa también latido.js. */
async function revisar() {
  const problemas = [];
  const detalle = [];

  /* 1. El sitio carga y sigue siendo la tienda (no un error de Netlify) */
  const casa = await sondear(SITIO + "/?salud=" + Date.now(), {
    headers: { "cache-control": "no-cache" }
  });

  if (!casa.ok) {
    problemas.push("El sitio respondió **" + (casa.status || casa.error) + "**");
  } else {
    const html = await casa.respuesta.text();
    if (!/Fayra/i.test(html)) {
      problemas.push("El sitio cargó pero no parece la tienda (falta el nombre)");
    } else {
      detalle.push("sitio: bien");
    }
  }

  /* 2. La función que registra visitas está viva (contesta pong, no cuenta) */
  const funcion = await sondear(SITIO + "/.netlify/functions/track", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cache-control": "no-cache" },
    body: JSON.stringify({ type: "ping" })
  });

  if (!funcion.ok) {
    problemas.push("La función de registro respondió **" + (funcion.status || funcion.error) + "**");
  } else {
    const j = await funcion.respuesta.json().catch(function () { return {}; });
    if (!j.pong) problemas.push("La función de registro contestó algo raro");
    else detalle.push("registro: vivo");
  }

  /* 3. Abacus responde (de ahí salen /stats y /hoy) */
  const contador = await sondear(ABACUS + "/get/" + NS + "/sondeo");
  if (contador.status === 0 || contador.status >= 500) {
    problemas.push("Los contadores (Abacus) no contestan");
  } else {
    /* 404 también sirve como vida: contesta el servicio aunque la clave no exista */
    detalle.push("contadores: responden");
  }

  return { problemas: problemas, detalle: detalle };
}

exports.revisar = revisar;

exports.handler = async function () {
  const r = await revisar();
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify({
      ok: r.problemas.length === 0,
      revisado: r.detalle,
      problemas: r.problemas,
      canalesSinConfigurar: faltan(),
      hora: new Date().toISOString()
    })
  };
};
