/* ============================================================
   Fayra Parfums · Panel de administración
   Netlify Function. Sirve el monitor y valida la contraseña.

   Por qué la sirve la función y no un HTML suelto: si el panel
   fuera panel.html, cualquiera que escribiera esa dirección en el
   navegador lo abriría. Acá el HTML se genera después de validar
   el token, así que sin la clave no hay nada que ver.

   Variables de entorno (en Netlify → Site settings → Environment):
     ADMIN_PASSWORD  → la clave del dueño
     SESSION_SECRET  → texto largo y aleatorio, solo para firmar tokens
   ============================================================ */

const crypto = require("crypto");

const HORA = 3600 * 1000;
const VALIDEZ = 12 * HORA;

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};

  /* ---------- entrar ---------- */
  if (q.accion === "entrar" && event.httpMethod === "POST") {
    let clave = "";
    try { clave = String((JSON.parse(event.body || "{}").clave) || ""); } catch (e) {}
    return entrar(clave);
  }

  /* ---------- datos del monitor ---------- */
  if (q.accion === "datos") {
    if (!event.headers.authorization) return json(401, { error: "sin sesión" });
    if (!valido(String(event.headers.authorization).replace(/^Bearer\s+/i, ""))) {
      return json(401, { error: "sesión vencida" });
    }
    return datos();
  }

  /* ---------- la página ---------- */
  const token = leerCookie(event);
  return html(200, pagina(token && valido(token) ? token : null));
};

/* =========================================================== sesión === */
function secreto() { return process.env.SESSION_SECRET || ""; }

function firmar(expira) {
  const cuerpo = String(expira);
  const firma = crypto.createHmac("sha256", secreto()).update(cuerpo).digest("base64url");
  return cuerpo + "." + firma;
}

function valido(token) {
  if (!token || !secreto()) return false;
  const partes = String(token).split(".");
  if (partes.length !== 2) return false;
  const esperado = crypto.createHmac("sha256", secreto()).update(partes[0]).digest("base64url");
  /* comparación de tiempo constante para no filtrar la firma */
  const a = Buffer.from(esperado);
  const b = Buffer.from(partes[1]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(partes[0]) > Date.now();
}

function leerCookie(event) {
  const c = (event.headers && event.headers.cookie) || "";
  const m = c.match(/(?:^|;\s*)fayra_panel=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function entrar(clave) {
  const buena = process.env.ADMIN_PASSWORD;
  if (!buena || !secreto()) {
    return json(503, {
      error: "Faltan las variables ADMIN_PASSWORD y SESSION_SECRET en Netlify."
    });
  }
  const a = Buffer.from(String(clave));
  const b = Buffer.from(String(buena));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return json(401, { error: "Clave incorrecta" });

  const token = firmar(Date.now() + VALIDEZ);
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "fayra_panel=" + token + "; Path=/panel; Max-Age=" + (VALIDEZ / 1000) + "; HttpOnly; SameSite=Strict; Secure"
    },
    body: JSON.stringify({ ok: true })
  };
}

/* ============================================================ datos === */

/* Netlify inyecta el siteID solo si Blobs está prendido en el proyecto.
   Con CONTEXT explícito funciona igual en cualquier caso. */
async function abrirStore() {
  const b = await import("@netlify/blobs");
  if (process.env.CONTEXT) return b.getStore({ name: "fayra", siteID: process.env.CONTEXT });
  return b.getStore("fayra");
}

async function datos() {
  let store;
  try {
    store = await abrirStore();
  } catch (e) {
    return json(503, { error: "No pude abrir Netlify Blobs: " + e.message });
  }

  const leer = async (k) => {
    try { return (await store.get(k, { type: "json" })) || null; }
    catch (e) { return null; }
  };

  const [metricas, online, eventos] = await Promise.all([
    leer("metricas"), leer("online"), leer("eventos")
  ]);

  const m = metricas || { total: 0, dias: {}, fuentes: {}, paginas: {}, dispositivos: {}, ubicaciones: {} };
  const ahora = Date.now();

  /* últimos 30 días, todos los días aunque no haya visitas */
  const dias = [];
  for (let i = 29; i >= 0; i--) {
    const f = new Date(ahora - i * 86400000).toISOString().slice(0, 10);
    dias.push({ fecha: f, ...(m.dias[f] || { v: 0, c: 0, o: 0 }) });
  }

  /* la semana que empieza el lunes */
  const hoy = new Date();
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const desdeLunes = lunes.toISOString().slice(0, 10);
  let semana = 0;
  for (const f in m.dias) if (f >= desdeLunes) semana += (m.dias[f].v || 0);

  const hoyF = hoy.toISOString().slice(0, 10);
  const hoyDatos = m.dias[hoyF] || { v: 0, c: 0, o: 0 };

  const enLinea = Object.values(online || {})
    .filter((v) => ahora - (v.visto || 0) < 100000)
    .map((v) => Object.assign({}, v, { hace: Math.max(0, Math.round((ahora - v.desde) / 1000)) }))
    .sort((a, b) => a.hace - b.hace);

  return json(200, {
    ahora: ahora,
    hoy: hoyDatos.v,
    semana: semana,
    total: m.total,
    clics: hoyDatos.c,
    pedidos: hoyDatos.o,
    enLinea: enLinea.length,
    dias: dias,
    enLineaLista: enLinea,
    eventos: (eventos || []).slice(0, 60),
    fuentes: top(m.fuentes, 8),
    paginas: top(m.paginas, 8),
    dispositivos: top(m.dispositivos, 8),
    ubicaciones: top(m.ubicaciones, 8)
  });
}

function top(obj, n) {
  return Object.keys(obj || {})
    .map((k) => ({ k: k, v: obj[k] }))
    .sort((a, b) => b.v - a.v)
    .slice(0, n);
}

function json(codigo, obj) {
  return {
    statusCode: codigo,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(obj)
  };
}

function html(codigo, cuerpo) {
  return {
    statusCode: codigo,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    body: cuerpo
  };
}

/* ============================================================ HTML === */
function pagina(lista) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Panel · Fayra Parfums</title>
<meta name="robots" content="noindex, nofollow" />
<link rel="icon" href="/assets/img/favicon.png" />
<style>
:root{
  --bg:#0c0a08; --card:#14100c; --line:rgba(201,163,92,.16); --line2:rgba(201,163,92,.34);
  --gold:#c9a35c; --gold2:#e6cd97; --ivory:#f4efe6; --muted:#a89c8a; --verde:#25d366;
}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ivory);
  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.55}
.gold{color:var(--gold)}

/* ---------- entrar ---------- */
.login{min-height:100vh;display:grid;place-items:center;padding:24px}
.login__box{width:100%;max-width:400px;border:1px solid var(--line);border-radius:18px;
  padding:36px 30px;background:linear-gradient(180deg,var(--card),var(--bg))}
.login__box img{width:64px;margin:0 auto 22px;border-radius:50%;display:block}
.login__box h1{font-size:23px;margin:0 0 6px;text-align:center;font-weight:500;letter-spacing:.02em}
.login__box p{color:var(--muted);font-size:13.5px;text-align:center;margin:0 0 26px}
.login label{display:block;font-size:11px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--gold);margin-bottom:9px}
.login input{width:100%;padding:14px 15px;border-radius:11px;border:1px solid var(--line);
  background:rgba(0,0,0,.35);color:var(--ivory);font:inherit;font-size:16px}
.login input:focus{outline:none;border-color:var(--gold)}
.login button{width:100%;margin-top:16px;padding:14px;border-radius:11px;border:0;cursor:pointer;
  background:var(--gold);color:#120e09;font:inherit;font-weight:700;font-size:14px;letter-spacing:.08em;
  text-transform:uppercase}
.login button:disabled{opacity:.5;cursor:default}
.login__err{color:#ff8f8f;font-size:13.5px;text-align:center;min-height:20px;margin:14px 0 0}
.login__volver{display:block;text-align:center;margin-top:20px;color:var(--muted);font-size:13px}

/* ---------- monitor ---------- */
.bar{display:flex;align-items:center;gap:16px;padding:16px 26px;border-bottom:1px solid var(--line);
  background:rgba(0,0,0,.35);position:sticky;top:0;z-index:5;flex-wrap:wrap}
.bar img{width:34px;border-radius:50%}
.bar b{font-weight:600;letter-spacing:.02em}
.bar__sep{width:1px;height:22px;background:var(--line)}
.pulso{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
.pulso i{width:9px;height:9px;border-radius:50%;background:var(--verde);animation:lat 1.8s infinite}
@keyframes lat{0%,100%{box-shadow:0 0 0 0 rgba(37,211,102,.55)}70%{box-shadow:0 0 0 9px rgba(37,211,102,0)}}
.bar__salir{margin-left:auto;padding:8px 16px;border:1px solid var(--line);border-radius:9px;
  background:none;color:var(--muted);cursor:pointer;font:inherit;font-size:13px}
.bar__salir:hover{border-color:var(--line2);color:var(--gold)}

.envoltura{max-width:1400px;margin:0 auto;padding:26px clamp(16px,3vw,30px) 70px}

.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:26px}
.kpi{border:1px solid var(--line);border-radius:14px;padding:18px 18px 16px;background:var(--card)}
.kpi b{display:block;font-size:33px;line-height:1;font-weight:300;letter-spacing:-.02em}
.kpi span{display:block;margin-top:7px;font-size:10.5px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--muted)}
.kpi--oro b{color:var(--gold)}
.kpi--verde b{color:var(--verde)}

.tarjetas{display:grid;grid-template-columns:1.55fr 1fr;gap:16px;margin-bottom:16px}
.tarjeta{border:1px solid var(--line);border-radius:14px;background:var(--card);overflow:hidden}
.tarjeta__h{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px 18px;border-bottom:1px solid var(--line)}
.tarjeta__h h2{margin:0;font-size:12px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--gold);font-weight:500}
.tarjeta__h span{font-size:11.5px;color:var(--muted)}
.tarjeta__c{padding:16px 18px}

/* gráfico de 30 días */
.graf{display:flex;align-items:flex-end;gap:3px;height:180px;padding-top:8px}
.graf i{flex:1;background:linear-gradient(180deg,var(--gold),rgba(201,163,92,.25));
  border-radius:3px 3px 0 0;min-height:2px;position:relative;transition:filter .2s}
.graf i:hover{filter:brightness(1.45)}
.graf i.hoy{background:linear-gradient(180deg,var(--gold2),var(--gold))}
.graf__x{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);margin-top:9px}

/* listas de desglose */
.desglose{display:grid;gap:11px}
.desglose__f{display:grid;gap:5px}
.desglose__f b{font-size:13px;font-weight:400;display:flex;justify-content:space-between;gap:10px}
.desglose__f b i{font-style:normal;color:var(--gold)}
.desglose__f u{display:block;height:4px;border-radius:4px;background:rgba(201,163,92,.12);overflow:hidden}
.desglose__f u s{display:block;height:100%;background:var(--gold);text-decoration:none;border-radius:4px}

/* tablas */
.tabla{width:100%;border-collapse:collapse;font-size:13px}
.tabla th{text-align:left;padding:9px 12px;font-size:10px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--gold);font-weight:500;white-space:nowrap}
.tabla td{padding:10px 12px;border-top:1px solid rgba(201,163,92,.09);color:var(--muted);white-space:nowrap}
.tabla tr:hover td{background:rgba(201,163,92,.045)}
.tabla td.negro{color:var(--ivory);font-variant-numeric:tabular-nums}
.tabla td.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
.tabla td small{display:block;color:var(--gold3,#8f6f34);font-size:11.5px}
.vacio{padding:26px 18px;color:var(--muted);font-size:13.5px;text-align:center}
.desplaza{max-height:420px;overflow:auto}

@media (max-width:900px){
  .tarjetas{grid-template-columns:1fr}
  .tarjeta__c{padding:13px}
  .tabla td,.tabla th{padding:9px 9px}
}
</style>
</head>
<body>
${lista ? monitor() : login()}
<script>
${lista ? guion() : ""}
</script>
</body>
</html>`;
}

function login() {
  return `
<form class="login" id="f">
  <div class="login__box">
    <img src="/assets/img/logo-f.png" alt="" />
    <h1>Panel de Fayra Parfums</h1>
    <p>Solo para vos.</p>
    <label for="clave">Clave</label>
    <input id="clave" name="clave" type="password" autocomplete="current-password" autofocus required />
    <button type="submit" id="btn">Entrar</button>
    <p class="login__err" id="err"></p>
    <a class="login__volver" href="/">← Volver a la tienda</a>
  </div>
</form>
<script>
document.getElementById("f").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  var btn = document.getElementById("btn"), err = document.getElementById("err");
  btn.disabled = true; err.textContent = ""; btn.textContent = "Entrando…";
  try {
    var r = await fetch("/panel?accion=entrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave: document.getElementById("clave").value })
    });
    var d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo entrar");
    location.reload();
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false; btn.textContent = "Entrar";
  }
});
</script>`;
}

function monitor() {
  return `
<header class="bar">
  <img src="/assets/img/logo-f.png" alt="" />
  <b>Fayra Parfums · Panel</b>
  <span class="bar__sep"></span>
  <span class="pulso"><i></i><span id="enLineaTxt">conectando…</span></span>
  <button class="bar__salir" id="salir">Salir</button>
</header>

<div class="envoltura">
  <div class="kpis">
    <div class="kpi kpi--oro"><b id="kHoy">—</b><span>Visitas hoy</span></div>
    <div class="kpi"><b id="kSemana">—</b><span>Esta semana</span></div>
    <div class="kpi"><b id="kTotal">—</b><span>Total</span></div>
    <div class="kpi kpi--verde"><b id="kOnline">—</b><span>En línea ahora</span></div>
    <div class="kpi"><b id="kClics">—</b><span>Clics hoy</span></div>
    <div class="kpi"><b id="kPedidos">—</b><span>Pedidos hoy</span></div>
  </div>

  <div class="tarjetas">
    <div class="tarjeta">
      <div class="tarjeta__h"><h2>Visitas · últimos 30 días</h2><span id="suma30"></span></div>
      <div class="tarjeta__c">
        <div class="graf" id="graf"></div>
        <div class="graf__x"><span id="desde"></span><span id="hasta"></span></div>
      </div>
    </div>
    <div class="tarjeta">
      <div class="tarjeta__h"><h2>Dispositivos</h2></div>
      <div class="tarjeta__c"><div class="desglose" id="lDisp"></div></div>
    </div>
  </div>

  <div class="tarjetas">
    <div class="tarjeta">
      <div class="tarjeta__h"><h2>En línea ahora</h2><span id="txtOnline"></span></div>
      <div class="desplaza"><table class="tabla" id="tOnline"></table></div>
    </div>
    <div class="tarjeta">
      <div class="tarjeta__h"><h2>Ubicaciones</h2></div>
      <div class="tarjeta__c"><div class="desglose" id="lUbic"></div></div>
    </div>
  </div>

  <div class="tarjetas">
    <div class="tarjeta">
      <div class="tarjeta__h"><h2>Visitas recientes</h2><span>las últimas 60</span></div>
      <div class="desplaza"><table class="tabla" id="tEventos"></table></div>
    </div>
    <div class="tarjeta">
      <div class="tarjeta__h"><h2>Páginas</h2></div>
      <div class="tarjeta__c"><div class="desglose" id="lPag"></div></div>
    </div>
  </div>

  <div class="tarjetas">
    <div class="tarjeta">
      <div class="tarjeta__h"><h2>De dónde llegan</h2></div>
      <div class="tarjeta__c"><div class="desglose" id="lFuentes"></div></div>
    </div>
    <div class="tarjeta">
      <div class="tarjeta__h"><h2>Buscar una IP</h2><span>para bloquear</span></div>
      <div class="tarjeta__c">
        <div class="desglose" id="lVistos"></div>
      </div>
    </div>
  </div>
</div>`;
}

function guion() {
  return `
function $(id) { return document.getElementById(id); }
function n(x) { return (x || 0).toLocaleString("es-SV"); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function hace(seg) {
  if (seg < 60) return "hace " + seg + " s";
  if (seg < 3600) return "hace " + Math.round(seg / 60) + " min";
  return "hace " + Math.round(seg / 3600) + " h";
}
function lista(el, datos, vacio) {
  if (!datos || !datos.length) { el.innerHTML = '<div class="vacio">' + vacio + "</div>"; return; }
  var tope = datos[0].v || 1;
  el.innerHTML = datos.map(function (d) {
    return '<div class="desglose__f"><b><span>' + esc(d.k) + "</span><i>" + n(d.v) +
      '</i></b><u><s style="width:' + Math.max(3, (d.v / tope) * 100) + '%"></s></u></div>';
  }).join("");
}
function tabla(el, filas, columnas, vacio) {
  if (!filas || !filas.length) { el.innerHTML = '<tbody><tr><td class="vacio">' + vacio + "</td></tr></tbody>"; return; }
  el.innerHTML = "<thead><tr>" + columnas.map(function (c) { return "<th>" + c + "</th>"; }).join("") +
    "</tr></thead><tbody>" + filas.map(function (f) { return "<tr>" + f.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody>";
}

async function tick() {
  try {
    var r = await fetch("/panel?accion=datos", { cache: "no-store" });
    if (r.status === 401) { location.reload(); return; }
    var d = await r.json();
    if (d.error) throw new Error(d.error);

    $("kHoy").textContent = n(d.hoy);
    $("kSemana").textContent = n(d.semana);
    $("kTotal").textContent = n(d.total);
    $("kOnline").textContent = n(d.enLinea);
    $("kClics").textContent = n(d.clics);
    $("kPedidos").textContent = n(d.pedidos);
    $("enLineaTxt").textContent = d.enLinea === 1 ? "1 persona en el sitio" : d.enLinea + " personas en el sitio";
    $("txtOnline").textContent = d.enLinea + " ahora";

    var tope = Math.max.apply(null, d.dias.map(function (x) { return x.v; }).concat([1]));
    $("graf").innerHTML = d.dias.map(function (x, i) {
      var alto = Math.max(2, (x.v / tope) * 100);
      var clase = i === d.dias.length - 1 ? " hoy" : "";
      var t = x.fecha.slice(5).replace("-", "/") + " · " + x.v + (x.v === 1 ? " visita" : " visitas");
      return '<i class="' + clase.trim() + '" style="height:' + alto + '%" title="' + t + '"></i>';
    }).join("");
    $("suma30").textContent = n(d.dias.reduce(function (a, b) { return a + b.v; }, 0)) + " en total";
    $("desde").textContent = d.dias[0].fecha;
    $("hasta").textContent = d.dias[d.dias.length - 1].fecha;

    lista($("lDisp"), d.dispositivos, "Todavía no hay datos");
    lista($("lUbic"), d.ubicaciones, "Todavía no hay datos");
    lista($("lPag"), d.paginas, "Todavía no hay datos");
    lista($("lFuentes"), d.fuentes, "Todavía no hay datos");

    var vistos = {};
    d.eventos.forEach(function (e) { vistos[e.ip] = (vistos[e.ip] || 0) + 1; });
    lista($("lVistos"), Object.keys(vistos).map(function (k) {
      return { k: k, v: vistos[k] };
    }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8), "Todavía no hay datos");

    tabla($("tOnline"), d.enLineaLista.map(function (v) {
      var donde = [v.ciudad, v.region, v.pais].filter(Boolean).join(", ");
      return [
        '<span class="mono negro">' + esc(v.ip) + "</span>",
        esc(donde || "—") + (v.ref ? "<small>viene de " + esc(v.ref.split("/")[2] || v.ref) + "</small>" : ""),
        esc(v.dispositivo) + "<small>" + esc(v.sistema) + "</small>",
        esc(v.navegador),
        esc(v.pagina),
        esc(hace(v.hace))
      ];
    }), ["IP", "Ubicación", "Dispositivo", "Navegador", "Página", "Entrada"], "Ahora mismo no hay nadie en el sitio");

    tabla($("tEventos"), d.eventos.map(function (e) {
      return [
        '<span class="mono negro">' + esc(e.ip) + "</span>",
        esc([e.ciudad, e.pais].filter(Boolean).join(", ") || "—"),
        esc(e.dispositivo),
        esc(e.navegador),
        esc(e.pagina),
        esc(new Date(e.t).toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit" }))
      ];
    }), ["IP", "Ubicación", "Dispositivo", "Navegador", "Página", "Hora"], "Todavía no hay visitas registradas");
  } catch (e) {
    console.error(e);
  }
}

$("salir").addEventListener("click", function () {
  document.cookie = "fayra_panel=; Path=/panel; Max-Age=0";
  location.reload();
});

tick();
setInterval(tick, 10000);`;
}
