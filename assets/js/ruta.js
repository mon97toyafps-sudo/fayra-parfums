/* ============================================================
   Fayra Parfums · La ruta
   ============================================================
   Toma el mapa real de El Salvador (assets/js/mapa-es.js) y va
   encendiendo los 14 departamentos uno por uno, mientras el texto del
   lateral va contando cómo es un pedido de punta a punta.

   El orden de las paradas rodea el país en un solo giro (oeste, norte,
   este, sur y de vuelta), calculado con el vecino más cercano sobre las
   coordenadas del mapa, para que la línea parezca un recorrido y no un
   enredo.

   Ojo: el "id" de cada parada es el que genera tools/mapa-el-salvador.pl,
   sin tildes (Usulután -> usulutan). Si se escribe mal, la parada se salta
   y tools/check-js.pl lo avisa.
   ============================================================ */

(function () {
  var M = window.MAPA_ES;
  var svg = document.getElementById("mapaES");
  if (!M || !svg) return;

  var gDeps   = document.getElementById("deps");
  var gTicks  = document.getElementById("ticks");
  var pRuta   = document.getElementById("rutaLinea");
  var pRutaB  = document.getElementById("rutaLineaB");
  var gPulso  = document.getElementById("pulso");
  var gAnillo = gPulso ? gPulso.querySelector(".pulso__anillo") : null;
  var elPaso  = document.getElementById("rutaPaso");
  var elDe    = document.getElementById("rutaDe");
  var elTexto = document.getElementById("rutaTexto");
  var elLista = document.getElementById("rutaLista");
  var elCine  = document.getElementById("cine");
  var raiz    = document.querySelector(".ruta");

  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- el recorrido --- */
  var PARADAS = [
    ["san-salvador", "Todo sale de San Salvador. Cada pedido se prepara a mano, uno por uno."],
    ["la-libertad",  "Arrancamos por el centro, cerca de la capital."],
    ["sonsonate",    "Seguimos por la costa, sin cargo extra."],
    ["ahuachapan",   "Hasta el oeste del país. El envío sigue incluido."],
    ["santa-ana",    "Santa Ana y su sierra. Aquí hay fragancia para todos los gustos."],
    ["chalatenango", "Seguimos hacia el norte del país."],
    ["cuscatlan",    "Revisamos el frasco: tiene que ser original."],
    ["cabanas",      "Lo empacamos para que llegue sin que se dañe."],
    ["san-vicente",  "El precio que viste ya trae el envío incluido."],
    ["la-paz",       "Si es tu primera compra, te asesoramos antes de que pagues."],
    ["usulutan",     "El pedido llega hasta la puerta de tu casa."],
    ["san-miguel",   "Coordinamos la entrega y te damos un día exacto."],
    ["morazan",      "Llegamos hasta la frontera, sin problema."],
    ["la-union",     "Los 14 departamentos del país, todos alcanzados."],
    ["san-salvador", "Volvemos a empezar. ¿Ya hiciste tu pedido?"]
  ];

  /* ---------------------------------------------------------- dibujo --- */
  var porId = {};
  var nodos = {};
  M.departamentos.forEach(function (d) {
    porId[d.id] = d;
    var p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", d.d);
    p.setAttribute("class", "dep");
    p.setAttribute("data-dep", d.id);
    gDeps.appendChild(p);
    nodos[d.id] = p;
  });

  var puntos = [];
  PARADAS.forEach(function (s) {
    var d = porId[s[0]];
    if (!d) {
      console.warn("Fayra: la parada " + s[0] + " no existe en el mapa");
      return;
    }
    puntos.push({ x: d.cx, y: d.cy, nombre: d.nombre, texto: s[1], id: s[0] });
  });
  if (puntos.length < 2) return;

  var N = puntos.length - 1;

  /* Catmull-Rom suave: pasa justo por cada punto sin cerrar bucles. */
  var TEN = 11;
  function tramo(i) {
    var p0 = puntos[i - 1] || puntos[i];
    var p1 = puntos[i];
    var p2 = puntos[i + 1];
    var p3 = puntos[i + 2] || puntos[i + 1];
    var c1x = p1.x + (p2.x - p0.x) / TEN, c1y = p1.y + (p2.y - p0.y) / TEN;
    var c2x = p2.x - (p3.x - p1.x) / TEN, c2y = p2.y - (p3.y - p1.y) / TEN;
    return "M" + p1.x.toFixed(2) + " " + p1.y.toFixed(2) +
           " C" + c1x.toFixed(2) + " " + c1y.toFixed(2) +
           ", " + c2x.toFixed(2) + " " + c2y.toFixed(2) +
           ", " + p2.x.toFixed(2) + " " + p2.y.toFixed(2);
  }

  /* un path oculto por tramo, solo para medirlo con precisión */
  var medidor = document.createElementNS(SVGNS, "g");
  medidor.setAttribute("visibility", "hidden");
  medidor.setAttribute("aria-hidden", "true");
  svg.appendChild(medidor);

  var tramos = [];
  var largoTotal = 0;
  var camino = "";
  for (var i = 0; i < N; i++) {
    var d = tramo(i);
    camino += d + " ";
    var oculto = document.createElementNS(SVGNS, "path");
    oculto.setAttribute("d", d);
    medidor.appendChild(oculto);
    var largo = oculto.getTotalLength();
    tramos.push({ path: oculto, largo: largo, desde: largoTotal });
    largoTotal += largo;
  }
  pRuta.setAttribute("d", camino);
  pRutaB.setAttribute("d", camino);

  /* el puntito de cada parada */
  puntos.forEach(function (p, k) {
    var c = document.createElementNS(SVGNS, "circle");
    c.setAttribute("cx", p.x);
    c.setAttribute("cy", p.y);
    c.setAttribute("r", (k === 0 || k === N) ? 2.4 : 1.6);
    c.setAttribute("class", "tick");
    gTicks.appendChild(c);
  });

  /* la lista del panel lateral */
  puntos.forEach(function (p, k) {
    var li = document.createElement("li");
    li.innerHTML = "<b>" + dos(k + 1) + "</b><span>" + p.nombre + "</span>";
    elLista.appendChild(li);
  });
  var items = elLista.children;

  function dos(n) { return (n < 10 ? "0" : "") + n; }

  /* --------------------------------------------------------- ritmo --- */
  var PASO = 1.9;          /* segundos por departamento */
  var ciclo = puntos.length * PASO;

  /* --------------------------------------------------------- estado --- */
  var corriendo = false;
  var t0 = 0;
  var indiceActual = -1;

  function enciende(i) {
    if (i === indiceActual) return;
    indiceActual = i;
    var p = puntos[i];

    /* los que ya se iluminaron quedan suave; el actual, encendido */
    for (var k = 0; k < items.length; k++) {
      items[k].classList.toggle("is-on", k === i);
      items[k].classList.toggle("is-pasado", k < i);
    }
    for (var m = 0; m < gDeps.children.length; m++) {
      gDeps.children[m].classList.remove("dep--vivo", "dep--visitado");
    }
    for (var v = 0; v < i; v++) nodos[puntos[v].id].classList.add("dep--visitado");
    nodos[p.id].classList.add("dep--vivo");

    /* la onda, en el centro del departamento */
    if (gPulso) gPulso.setAttribute("transform", "translate(" + p.x + "," + p.y + ")");

    /* la línea de oro llega hasta donde vamos */
    if (i < N) {
      pRutaB.style.strokeDasharray = largoTotal + " " + largoTotal;
      pRutaB.style.strokeDashoffset = (largoTotal - tramos[i].desde).toFixed(1);
    } else {
      pRutaB.style.strokeDasharray = largoTotal + " " + largoTotal;
      pRutaB.style.strokeDashoffset = "0";
    }

    if (elPaso) elPaso.textContent = dos(i + 1);
    if (elDe) elDe.textContent = p.nombre;
    if (elTexto) elTexto.textContent = p.texto;
  }

  function frame(ahora) {
    if (!corriendo) return;
    var t = ((ahora - t0) / 1000) % ciclo;
    enciende(Math.floor(t / PASO));
    requestAnimationFrame(frame);
  }

  function quieto() {
    corriendo = false;
    if (raiz) raiz.classList.remove("ruta--viva");
    pRutaB.style.strokeDasharray = "";
    pRutaB.style.strokeDashoffset = "";
    for (var k = 0; k < items.length; k++) items[k].classList.remove("is-on", "is-pasado");
    for (var m = 0; m < gDeps.children.length; m++) {
      gDeps.children[m].classList.remove("dep--vivo", "dep--visitado");
      gDeps.children[m].classList.add("dep--apagado");
    }
    for (var v = 0; v < puntos.length; v++) nodos[puntos[v].id].classList.remove("dep--apagado");
    nodos[puntos[0].id].classList.add("dep--vivo");
    if (gPulso) gPulso.setAttribute("transform", "translate(" + puntos[0].x + "," + puntos[0].y + ")");
    if (items[0]) items[0].classList.add("is-on");
    if (elPaso) elPaso.textContent = "01";
    if (elDe) elDe.textContent = puntos[0].nombre;
    if (elTexto) elTexto.textContent = puntos[0].texto;
    indiceActual = 0;
  }

  function arranca() {
    if (corriendo) return;
    corriendo = true;
    indiceActual = -1;
    /* arranca en un punto cualquiera para que no siempre empiece igual */
    t0 = performance.now() - Math.random() * (ciclo * 1000);
    if (raiz) raiz.classList.add("ruta--viva");
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------- arranque --- */
  /* Los municipios se encienden siempre. No se consulta prefers-reduced-motion
     a propósito: con las animaciones del sistema apagadas (Windows lo trae así
     de fábrica) el mapa se quedaba congelado y parecía roto. El botón sirve
     para pausarlo si a alguien le molesta el movimiento. */
  var pausadoAMano = false;
  var etiqueta = elCine ? elCine.querySelector("i") : null;

  function boton(pausado) {
    if (!elCine) return;
    elCine.classList.toggle("cine--on", !pausado);
    elCine.setAttribute("aria-pressed", pausado ? "false" : "true");
    if (etiqueta) etiqueta.textContent = pausado ? "Ver la animación" : "Pausar si molesta";
  }

  function alterna() {
    pausadoAMano = corriendo;
    if (pausadoAMano) { quieto(); boton(true); }
    else { arranca(); boton(false); }
  }

  quieto();
  arranca();
  boton(false);

  if (elCine) elCine.addEventListener("click", alterna);

  /* con la pestaña escondida el requestAnimationFrame se detiene: al volver
     no queremos que salte de golpe, pero si el visitante lo paró a mano que
     siga parado. */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) corriendo = false;
    else if (!pausadoAMano) arranca();
  });
})();
