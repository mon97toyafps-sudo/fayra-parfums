/* ============================================================
   Fayra Parfums · Latido del sitio → #alertas
   Netlify Function programada (cada hora, minuto 5).

   Hace las mismas comprobaciones que salud.js y, si algo falla,
   manda el aviso al canal de alertas.

   Por qué está separado de salud.js: Netlify no deja abrir por URL
   las funciones con schedule (devuelven 403 desde el borde), y si el
   envío a Discord estuviera en la función pública cualquiera podría
   usarla para llenar el canal. Así: salud.js informa, latido.js avisa.
   ============================================================ */

const salud = require("./salud");

const ALERTAS = process.env.DISCORD_WEBHOOK_ALERTAS || process.env.DISCORD_WEBHOOK_URL;
const SITIO = "https://fayraparfumsv.netlify.app";

exports.handler = async function () {
  const r = await salud.revisar();

  if (!r.problemas.length) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, revisado: r.detalle, aviso: "nada que reportar" })
    };
  }

  let avisado = false;
  if (ALERTAS) {
    try {
      const envio = await fetch(ALERTAS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "Fayra Alertas",
          embeds: [{
            title: "🚨 Algo no está respondiendo",
            color: 0xe74c3c,
            description: r.problemas.map(function (p) { return "• " + p; }).join("\n"),
            fields: [{ name: "Lo que sí respondió", value: r.detalle.join("\n") || "nada", inline: false }],
            footer: { text: "Se repite cada hora mientras dure · " + SITIO },
            timestamp: new Date().toISOString()
          }]
        })
      });
      avisado = envio.ok;
    } catch (e) {
      avisado = false;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: false,
      problemas: r.problemas,
      aviso: ALERTAS ? (avisado ? "enviado" : "no pude mandar la alerta") : "sin canal de alertas"
    })
  };
};
