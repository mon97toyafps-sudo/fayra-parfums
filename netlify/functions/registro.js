/* ============================================================
   Fayra Parfums · Registro de tráfico para el panel
   Netlify Function. El sitio la llama en cada visita y cada 30
   segundos mientras la persona siga en la página.

   Guarda todo en Netlify Blobs:
     metricas  → totales, visitas por día, fuentes, páginas, dispositivos
     online    → quién está adentro ahora mismo
     geo       → cache de IP → país/ciudad (para no consultar la API cada vez)
     eventos   → últimas 400 visitas, para la tabla del panel

   La IP se guarda completa a propósito: el dueño la usa para bloquear
   a quien esté echando la página abajo.
   ============================================================ */

const TTL_ONLINE = 100000;   /* sin ping en 100 s → se da por fuera */
const MAX_EVENTOS = 400;
const TTL_GEO = 30 * 24 * 3600 * 1000;

let blobs = null;

/* Blobs se carga con import dinámico: si el paquete faltara, el resto de
   la función sigue sirviendo en vez de caerse entera en el deploy. */
async function abrirStore() {
  if (!blobs) {
    const b = await import("@netlify/blobs");
    if (process.env.CONTEXT) blobs = b.getStore({ name: "fayra", siteID: process.env.CONTEXT });
    else blobs = b.getStore("fayra");
  }
  return blobs;
}

async function lee(store) {
  try { return (await store.get("json", { type: "json" })) || null; }
  catch (e) { return null; }
}

/* ------------------------------------------------------------ headers --- */
function header(h, nombre) {
  const bajo = nombre.toLowerCase();
  for (const k in h) if (k.toLowerCase() === bajo) return h[k];
  return "";
}

function ipDe(event) {
  const h = event.headers || {};
  return (
    header(h, "x-nf-client-connection-ip") ||
    header(h, "cf-connecting-ip") ||
    header(h, "x-forwarded-for").split(",")[0].trim() ||
    "0.0.0.0"
  );
}

/* --------------------------------------------------------- dispositivo --- */
function navegador(ua) {
  let n = "Otro";
  if (/Edg\//i.test(ua)) n = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) n = "Opera";
  else if (/SamsungBrowser/i.test(ua)) n = "Samsung Internet";
  else if (/Firefox\//i.test(ua)) n = "Firefox";
  else if (/CriOS/i.test(ua)) n = "Chrome";
  else if (/Chrome\//i.test(ua)) n = "Chrome";
  else if (/Safari\//i.test(ua)) n = "Safari";
  return n;
}

function sistema(ua) {
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Otro";
}

/* Marca y modelo cuando se pueden sacar del user-agent. */
function dispositivo(ua) {
  if (/iPad/i.test(ua)) return "iPad";
  if (/iPhone/i.test(ua)) {
    const m = ua.match(/iPhone OS (\d+)[_.](\d+)/);
    return "iPhone" + (m ? " · iOS " + m[1] : "");
  }
  if (/iPod/i.test(ua)) return "iPod";

  /* Android: el modelo suele venir comoBuild/XXXX,.Build/MMM */
  let modelo = "";
  const and = ua.match(/Android [\d.]+; ([^)]+?)(?: Build\/|;|\))/);
  if (and) modelo = and[1].trim();

  const marcas = [
    [/\bSM-[A-Z0-9]+/i, "Samsung"],
    [/\bGT-[A-Z0-9]+/i, "Samsung"],
    [/\bPixel\s?\d/i, "Google"],
    [/\bRedmi\b|\bPOCO\b|\bMI\s?\d|\bMIX\b/i, "Xiaomi"],
    [/\bRedmi\s?\w+/i, "Xiaomi"],
    [/CPH\d{4}/i, "Oppo"],
    [/\bv\d{4}\b/i, "Vivo"],
    [/\bRMX\d{3}/i, "Realme"],
    [/\bCPH/i, "Oppo"],
    [/\bSM-/i, "Samsung"],
    [/\bXT\d{4}/i, "Sony"],
    [/\bHTC\b/i, "HTC"],
    [/\bLG-[A-Z0-9]+/i, "LG"],
    [/\bNexus\b|\bPixel\b/i, "Google"],
    [/\bNokia\b|\bTA-\d+/i, "Nokia"],
    [/\bONEPLUS\b|\bPJZ\d{2}/i, "OnePlus"]
  ];
  for (const [re, marca] of marcas) {
    const hit = ua.match(re);
    if (hit) return marca + (modelo && modelo.indexOf(";") === -1 ? " " + modelo : "");
  }
  if (/Android/i.test(ua)) return modelo ? "Android · " + modelo : "Android";
  if (/Windows/i.test(ua)) return "Computadora";
  if (/Mac OS X/i.test(ua)) return "Mac";
  if (/CrOS/i.test(ua)) return " Chromebook";
  if (/Linux/i.test(ua)) return "Linux";
  return "Desconocido";
}

/* ------------------------------------------------------- geolocalizar --- */
async function ubicacion(ip, cache) {
  if (cache && cache[ip] && Date.now() - cache[ip].t < TTL_GEO) return cache[ip];
  const geo = { pais: "—", region: "", ciudad: "", lat: null, lon: null, t: Date.now() };
  try {
    const r = await fetch(
      "https://ip-api.com/json/" + encodeURIComponent(ip) +
      "?fields=status,country,regionName,city,lat,lon&lang=es",
      { signal: AbortSignal.timeout(2500) }
    );
    if (r.ok) {
      const d = await r.json();
      if (d && d.status === "success") {
        geo.pais = d.country || "—";
        geo.region = d.regionName || "";
        geo.ciudad = d.city || "";
        geo.lat = d.lat;
        geo.lon = d.lon;
      }
    }
  } catch (e) { /* sin geo: el panel muestra el guion, nada más */ }
  if (cache) cache[ip] = geo;
  return geo;
}

/* --------------------------------------------------------------- main --- */
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "solo POST" };
  }

  let store;
  try {
    store = await abrirStore();
  } catch (e) {
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "blobs: " + e.message })
    };
  }

  let cuerpo = {};
  try { cuerpo = JSON.parse(event.body || "{}"); } catch (e) {}

  const ip = ipDe(event);
  const ua = header(event.headers || {}, "user-agent");
  const sid = String(cuerpo.sid || "").slice(0, 60) || ("ip-" + ip);
  const ahora = Date.now();
  const hoy = new Date(ahora).toISOString().slice(0, 10);

  const [metricas, online, geo, eventos] = await Promise.all([
    lee(store.get("metricas")),
    lee(store.get("online")),
    lee(store.get("geo")),
    lee(store.get("eventos"))
  ]);

  const m = metricas || { total: 0, dias: {}, fuentes: {}, paginas: {}, dispositivos: {}, ubicaciones: {} };
  const o = online || {};
  const g = geo || {};
  const ev = eventos || [];

  const u = await ubicacion(ip, g);

  const ficha = {
    ip: ip,
    pais: u.pais,
    region: u.region,
    ciudad: u.ciudad,
    dispositivo: dispositivo(ua),
    sistema: sistema(ua),
    navegador: navegador(ua),
    pagina: String(cuerpo.path || "/").slice(0, 120),
    ref: String(cuerpo.ref || "").slice(0, 160),
    accion: String(cuerpo.accion || "visita").slice(0, 40),
    desde: ahora
  };

  /* --- quien está adentro ahora --- */
  o[sid] = Object.assign({}, ficha, { visto: ahora });
  for (const k in o) {
    if (ahora - (o[k].visto || 0) > TTL_ONLINE) delete o[k];
  }

  /* --- acumulados --- */
  if (!m.dias[hoy]) m.dias[hoy] = { v: 0, c: 0, o: 0 };
  if (ficha.accion === "visita") { m.total++; m.dias[hoy].v++; }
  else if (ficha.accion === "pedido") { m.dias[hoy].o++; m.dias[hoy].c++; }
  else m.dias[hoy].c++;

  const origen = ficha.ref ? sitioDe(ficha.ref) : "directo";
  m.fuentes[origen] = (m.fuentes[origen] || 0) + 1;
  m.paginas[ficha.pagina] = (m.paginas[ficha.pagina] || 0) + 1;
  m.dispositivos[ficha.dispositivo] = (m.dispositivos[ficha.dispositivo] || 0) + 1;
  const lugar = [u.ciudad, u.pais].filter(Boolean).join(", ") || "—";
  m.ubicaciones[lugar] = (m.ubicaciones[lugar] || 0) + 1;

  /* --- últimas visitas --- */
  if (ficha.accion === "visita") {
    ev.unshift({ t: ahora, ip: ip, pais: u.pais, ciudad: u.ciudad, dispositivo: ficha.dispositivo, navegador: ficha.navegador, pagina: ficha.pagina });
    if (ev.length > MAX_EVENTOS) ev.length = MAX_EVENTOS;
  }

  /* --- no guardar más de 120 días de histórico --- */
  const dias = Object.keys(m.dias).sort();
  while (dias.length > 120) delete m.dias[dias.shift()];

  await Promise.all([
    store.set("metricas", JSON.stringify(m), { type: "json" }),
    store.set("online", JSON.stringify(o), { type: "json" }),
    store.set("geo", JSON.stringify(g), { type: "json" }),
    store.set("eventos", JSON.stringify(ev), { type: "json" })
  ]);

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: '{"ok":true}' };
};

/* De dónde vino la visita, para el desglose de fuentes. */
function sitioDe(ref) {
  try { return new URL(ref).hostname.replace(/^www\./, ""); }
  catch (e) { return "otro"; }
}
