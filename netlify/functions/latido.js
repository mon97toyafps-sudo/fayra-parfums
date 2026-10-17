/* ============================================================
   Fayra Parfums · Latido del sitio → #alertas
   Netlify Function programada (cada hora).

   No cuenta visitas: pregunta si el sitio responde, si la función
   de registro está viva y si Abacus (los contadores) contesta.
   Si algo falla, manda un aviso al canal de alertas.

   Se puede disparar a mano para probar:
     /.netlify/functions/latido
   ============================================================ */

const ALERTAS = process.env.DISCORD_WEBHOOK_ALERTAS || process.env.DISCORD_WEBHOOK_URL;
const SITIO = "https://fayraparfumsv.netlify.app";
const ABACUS = "https://abacus.jasoncameron.dev";
const NS = "fayraparfumsv.netlify.app";
const SONDEO_MS = 8000;

/* Sin canal de alertas no hay a quién avisar: se devuelve el diagnóstico
   igual, para poder verlo entrando a la URL a mano. */
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

exports.handler = async function () {
  const problemas = [];
  const detalle = [];

  /* 1. El sitio carga y sigue siendo la tienda (no un error de Netlify) */
  const casa = await sondear(SITIO + "/?latido=" + Date.now(), {
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

  /* 2. La función que registra visitas está viva (no cuenta nada) */
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
  const contador = await sondear(ABACUS + "/get/" + NS + "/historial-sondeo");
  if (contador.status === 0 || contador.status >= 500) {
    problemas.push("Los contadores (Abacus) no contestan");
  } else {
    /* 404 también sirve como vida: contesta el servicio, aunque la clave no exista */
    detalle.push("contadores: responden");
  }

  if (!problemas.length) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, revisado: detalle, canalesSinConfigurar: faltan() })
    };
  }

  /* Hay problemas: se avisa al canal de alertas */
  let avisado = false;
  if (ALERTAS) {
    try {
      const r = await fetch(ALERTAS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "Fayra Alertas",
          embeds: [{
            title: "🚨 Algo no está respondiendo",
            color: 0xe74c3c,
            description: problemas.map(function (p) { return "• " + p; }).join("\n"),
            fields: [{ name: "Lo que sí respondió", value: detalle.join("\n") || "nada", inline: false }],
            footer: { text: "Se repite cada hora mientras dure · " + SITIO },
            timestamp: new Date().toISOString()
          }]
        })
      });
      avisado = r.ok;
    } catch (e) {
      avisado = false;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: false,
      problemas: problemas,
      avisado: avisado,
      aviso: ALERTAS ? (avisado ? "enviado" : "no pude mandar la alerta") : "sin canal de alertas"
    })
  };
};
