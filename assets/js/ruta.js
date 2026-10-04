/* ============================================================
   Fayra Parfums · La ruta: el carrito recorre El Salvador
   ============================================================
   Toma el mapa real (assets/js/mapa-es.js) y anima un carrito por
   una curva suave que pasa por los 14 departamentos. En cada parada
   se enciende el departamento y cambia el texto del proceso.

   La curva se arma tramo por tramo con Catmull-Rom, y cada tramo
   se mide con getPointAtLength sobre su propio <path>. Así cada
   parada cae exactamente en su punto, sin adivinar longitudes.
   ============================================================ */

(function () {
  var M = window.MAPA_ES;
  var svg = document.getElementById("mapaES");
  if (!M || !svg) return;

  var gDeps   = document.getElementById("deps");
  var gTicks  = document.getElementById("ticks");
  var pRuta   = document.getElementById("rutaLinea");
  var pRutaB  = document.getElementById("rutaLineaB");
  var gCarro  = document.getElementById("carro");
  var r1      = document.getElementById("rueda1");
  var r2      = document.getElementById("rueda2");
  var elPaso  = document.getElementById("rutaPaso");
  var elDe    = document.getElementById("rutaDe");
  var elTexto = document.getElementById("rutaTexto");
  var elLista = document.getElementById("rutaLista");
  var elCine  = document.getElementById("cine");
  var raiz    = document.querySelector(".ruta");

  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- el recorrido: los 14 departamentos, arrancando y terminando
         en San Salvador (desde ahí sale todo) --- */
  var PARADAS = [
    ["san-salvador", "Todo sale de San Salvador. Cada pedido se prepara a mano, uno por uno."],
    ["santa-ana",    "Nos escribís y te confirmamos que hay disponibilidad."],
    ["chalatenango", "Revisamos el frasco antes de empacarlo: tiene que ser original."],
    ["cabanas",      "Lo envolvemos para que llegue sin que se damage en el camino."],
    ["san-vicente",  "El precio que viste ya trae el envío. No se paga nada extra."],
    ["la-paz",       "Si es tu primera compra, te asesoramos antes de que pagues."],
    ["cuscatlan",    "Te mandamos el resumen del pedido por WhatsApp."],
    ["san-salvador", "Salimos hacia tu departamento."],
    ["la-union",     "Llegamos a los 14 departamentos del país."],
    ["san-miguel",   "Coordinamos la entrega y te damos un día exacto."],
    ["usultan",      "El carrito llega hasta la puerta de tu casa."],
    ["morazan",      "Pagás en efectivo cuando te lo entregamos, no antes."],
    ["sonsonate",    "Si querías otra fragancia, hay más en el catálogo."],
    ["ahuachapan",   "Gracias por confiar en Fayra Parfums."],
    ["san-salvador", "Volvemos a empezar. ¿Ya hiciste tu pedido?"]
  ];

  /* ---------------------------------------------------------- dibujo --- */
  var porId = {};
  M.departamentos.forEach(function (d) {
    porId[d.id] = d;
    var p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", d.d);
    p.setAttribute("class", "dep");
    p.setAttribute("data-dep", d.id);
    gDeps.appendChild(p);
  });

  var puntos = PARADAS.map(function (s) {
    var d = porId[s[0]];
    return { x: d.cx, y: d.cy, nombre: d.nombre, texto: s[1] };
  });

  /* Catmull-Rom: una curva que pasa justo por cada punto, sin las
     esquinas vivas de una poligonal. */
  function tramo(i) {
    var p0 = puntos[i - 1] || puntos[i];
    var p1 = puntos[i];
    var p2 = puntos[i + 1];
    var p3 = puntos[i + 2] || puntos[i + 1];
    var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    return "M" + p1.x.toFixed(2) + " " + p1.y.toFixed(2) +
           " C" + c1x.toFixed(2) + " " + c1y.toFixed(2) +
           ", " + c2x.toFixed(2) + " " + c2y.toFixed(2) +
           ", " + p2.x.toFixed(2) + " " + p2.y.toFixed(2);
  }

  var N = puntos.length - 1;

  /* un path oculto por tramo, solo para poder medirlo con precisión */
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

  /* los puntitos de cada parada */
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

  /* --------------------------------------------------------- timing --- */
  var VELOCIDAD = 17;   /* unidades svg por segundo */
  var QUIETO    = 1.9;  /* segundos parado en cada parada */

  for (var t = 0; t < tramos.length; t++) {
    tramos[t].viaje = tramos[t].largo / VELOCIDAD;
    tramos[t].paso  = tramos[t].viaje + QUIETO;
  }
  var ciclo = tramos.reduce(function (a, b) { return a + b.paso; }, 0);

  /* --------------------------------------------------------- estado --- */
  var corriendo = false;
  var t0 = 0;
  var indiceActual = -1;

  function pinta(i, avance) {
    var tr = tramos[i];
    var L = tr.largo * avance;
    var pt = tr.path.getPointAtLength(L);
    var a1 = tr.path.getPointAtLength(Math.max(0, L - 0.7));
    var a2 = tr.path.getPointAtLength(Math.min(tr.largo, L + 0.7));
    var ang = Math.atan2(a2.y - a1.y, a2.x - a1.x) * 180 / Math.PI;

    gCarro.setAttribute("transform",
      "translate(" + pt.x.toFixed(2) + "," + pt.y.toFixed(2) + ") rotate(" + ang.toFixed(1) + ")");

    /* las ruedas giran según lo que avanzó, no según el reloj */
    var recorrido = tr.desde + L;
    var giro = (recorrido / 24).toFixed(1);
    r1.setAttribute("transform", "rotate(" + giro + ")");
    r2.setAttribute("transform", "rotate(" + giro + ")");

    /* la línea se dibuja a medida que el carrito avanza */
    var pintado = tr.desde + L;
    pRuta.style.strokeDasharray = largoTotal;
    pRutaB.style.strokeDasharray = largoTotal;
    pRuta.style.strokeDashoffset = (largoTotal - pintado).toFixed(1);
    pRutaB.style.strokeDashoffset = (largoTotal - pintado).toFixed(1);

    if (i !== indiceActual) {
      indiceActual = i;
      for (var k = 0; k < items.length; k++) items[k].classList.toggle("is-on", k === i);
      for (var m = 0; m < gDeps.children.length; m++) gDeps.children[m].classList.remove("dep--vivo");
      var nodo = gDeps.querySelector('[data-dep="' + slugDe(i) + '"]');
      if (nodo) nodo.classList.add("dep--vivo");
      if (elPaso) elPaso.textContent = dos(i + 1);
      if (elDe) elDe.textContent = puntos[i].nombre;
      if (elTexto) elTexto.textContent = puntos[i].texto;
    }
  }

  function slugDe(i) { return PARADAS[i][0]; }

  function quieto() {
    corriendo = false;
    if (raiz) raiz.classList.remove("ruta--viva");

    /* sin animación el mapa se ve entero y el carrito se queda en la base */
    pRuta.style.strokeDasharray = "";
    pRuta.style.strokeDashoffset = "";
    pRutaB.style.strokeDasharray = "";
    pRutaB.style.strokeDashoffset = "";
    for (var k = 0; k < items.length; k++) items[k].classList.remove("is-on");
    for (var m = 0; m < gDeps.children.length; m++) {
      gDeps.children[m].classList.remove("dep--vivo");
      gDeps.children[m].classList.add("dep--apagado");
    }
    var base = gDeps.querySelector('[data-dep="san-salvador"]');
    if (base) base.classList.remove("dep--apagado");

    gCarro.setAttribute("transform",
      "translate(" + puntos[0].x + "," + puntos[0].y + ") rotate(0)");

    if (items[0]) items[0].classList.add("is-on");
    if (elPaso) elPaso.textContent = "01";
    if (elDe) elDe.textContent = puntos[0].nombre;
    if (elTexto) elTexto.textContent = puntos[0].texto;
    indiceActual = -1;
  }

  function frame(ahora) {
    if (!corriendo) return;
    var t = ((ahora - t0) / 1000) % ciclo;
    var acum = 0;
    for (var i = 0; i < tramos.length; i++) {
      if (t < acum + tramos[i].paso) {
        var local = Math.min(1, (t - acum) / tramos[i].viaje);
        /* easeInOut: sale suave, frena en la parada */
        var e = local < 0.5
          ? 2 * local * local
          : 1 - Math.pow(-2 * local + 2, 2) / 2;
        pinta(i, e);
        break;
      }
      acum += tramos[i].paso;
      if (i === tramos.length - 1) pinta(0, 0);
    }
    requestAnimationFrame(frame);
  }

  function arranca() {
    if (corriendo) return;
    corriendo = true;
    indiceActual = -1;
    /* arranca en un punto cualquiera del viaje para no repetir siempre igual */
    t0 = performance.now() - Math.random() * (ciclo * 1000);
    if (raiz) raiz.classList.add("ruta--viva");
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------- arranque --- */
  /* El carrito SIEMPRE viaja. No se consulta prefers-reduced-motion a
     propósito: con las animaciones del sistema apagadas (Windows lo trae
     asi de fábrica) el mapa se quedaba congelado y parecía roto. Si alguien
     no quiere movimiento, tiene el botón de pausa a mano. */
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

  arranca();
  boton(false);

  if (elCine) elCine.addEventListener("click", alterna);

  /* con la pestaña escondida el requestAnimationFrame se detiene: al volver
     no queremos que el carrito salte de golpe al punto que le toca, pero si
     el visitante lo paró a mano, que siga parado. */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) corriendo = false;
    else if (!pausadoAMano) arranca();
  });
})();
