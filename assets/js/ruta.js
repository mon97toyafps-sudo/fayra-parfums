/* ============================================================
   Fayra Parfums · La ruta
   ============================================================
   No hay líneas ni dibujos en el mapa: solo una luz dorada que viaja
   de un departamento al siguiente. Al llegar, el departamento se
   enciende y aparece su nombre. Los que ya pasaron quedan iluminados
   suave, así que al final de la vuelta el país entero está encendido.

   El orden de las paradas rodea El Salvador en un solo giro (oeste,
   norte, este, sur y de vuelta), calculado con el vecino más cercano
   sobre las coordenadas del mapa, para que el viaje se lea como un
   recorrido y no como un enredo.

   Ojo: el "id" de cada parada es el que genera tools/mapa-el-salvador.pl,
   sin tildes (Usulután -> usulutan). Si se escribe mal, la parada se salta
   y tools/check-js.pl lo avisa.
   ============================================================ */

(function () {
  var M = window.MAPA_ES;
  var svg = document.getElementById("mapaES");
  if (!M || !svg) return;

  var gDeps    = document.getElementById("deps");
  var gTicks   = document.getElementById("ticks");
  var gOrbita  = document.getElementById("orbita");
  var elEtiqueta = document.getElementById("etiqueta");
  var elPaso   = document.getElementById("rutaPaso");
  var elDe     = document.getElementById("rutaDe");
  var elTexto  = document.getElementById("rutaTexto");
  var elLista  = document.getElementById("rutaLista");
  var raiz     = document.querySelector(".ruta");

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

  /* Curva suave entre dos paradas, solo para que la luz viaje redondeada.
     Sin ella, la luz daría tres saltos rectos. */
  function puente(i) {
    var p0 = puntos[i - 1] || puntos[i];
    var p1 = puntos[i];
    var p2 = puntos[i + 1];
    var p3 = puntos[i + 2] || puntos[i + 1];
    var T = 11;
    var c1x = p1.x + (p2.x - p0.x) / T, c1y = p1.y + (p2.y - p0.y) / T;
    var c2x = p2.x - (p3.x - p1.x) / T, c2y = p2.y - (p3.y - p1.y) / T;
    return "M" + p1.x + " " + p1.y +
           " C" + c1x + " " + c1y + ", " + c2x + " " + c2y + ", " + p2.x + " " + p2.y;
  }

  var medidor = document.createElementNS(SVGNS, "g");
  medidor.setAttribute("visibility", "hidden");
  medidor.setAttribute("aria-hidden", "true");
  svg.appendChild(medidor);

  var tramos = [];
  for (var i = 0; i < N; i++) {
    var oculto = document.createElementNS(SVGNS, "path");
    oculto.setAttribute("d", puente(i));
    medidor.appendChild(oculto);
    tramos.push({ path: oculto, largo: oculto.getTotalLength() });
  }

  /* el puntito de cada parada */
  puntos.forEach(function (p, k) {
    var c = document.createElementNS(SVGNS, "circle");
    c.setAttribute("cx", p.x);
    c.setAttribute("cy", p.y);
    c.setAttribute("r", (k === 0 || k === N) ? 2.4 : 1.5);
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
  var PASO = 1.15;                /* segundos por departamento */
  var VIAJE = 0.46;               /* parte del paso en la que viaja la luz */
  var ciclo = puntos.length * PASO;

  /* --------------------------------------------------------- estado --- */
  var corriendo = false;
  var t0 = 0;
  var indiceActual = -1;

  /* Coloca la luz. En la primera mitad del paso vuela al departamento
     siguiente; en la segunda se queda descansando ahí. */
  function mueveLuz(i, local) {
    if (i >= N) { pon(puntos[N].x, puntos[N].y); return; }
    var avance = Math.min(1, local / VIAJE);
    var e = avance < 0.5
      ? 2 * avance * avance
      : 1 - Math.pow(-2 * avance + 2, 2) / 2;     /* arranca y frena suave */
    var pt = tramos[i].path.getPointAtLength(tramos[i].largo * e);
    pon(pt.x, pt.y);
  }

  function pon(x, y) {
    if (gOrbita) gOrbita.setAttribute("transform", "translate(" + x.toFixed(2) + "," + y.toFixed(2) + ")");
  }

  function enciende(i) {
    if (i === indiceActual) return;
    indiceActual = i;
    var p = puntos[i];

    for (var k = 0; k < items.length; k++) {
      items[k].classList.toggle("is-on", k === i);
      items[k].classList.toggle("is-pasado", k < i);
    }
    for (var m = 0; m < gDeps.children.length; m++) {
      gDeps.children[m].classList.remove("dep--vivo", "dep--visitado");
    }
    for (var v = 0; v < i; v++) nodos[puntos[v].id].classList.add("dep--visitado");
    nodos[p.id].classList.add("dep--vivo");

    if (elEtiqueta) {
      elEtiqueta.textContent = p.nombre;
      /* el nombre va debajo del departamento; si está pegado al borde de
         arriba, se pone abajo para que no se salga del mapa */
      var arriba = p.y < 74;
      elEtiqueta.setAttribute("x", Math.max(30, Math.min(450, p.x)));
      elEtiqueta.setAttribute("y", arriba ? p.y + 18 : p.y - 11);
      /* se saca y se vuelve a poner la clase para que la entrada se repita */
      elEtiqueta.classList.remove("etiqueta--entra");
      void elEtiqueta.getBoundingClientRect();
      elEtiqueta.classList.add("etiqueta--entra");
    }

    if (elPaso) elPaso.textContent = dos(i + 1);
    if (elDe) elDe.textContent = p.nombre;
    if (elTexto) elTexto.textContent = p.texto;
  }

  function frame(ahora) {
    if (!corriendo) return;
    var t = ((ahora - t0) / 1000) % ciclo;
    var i = Math.floor(t / PASO);
    var local = (t - i * PASO) / PASO;

    /* el departamento enciende cuando la luz ya llegó */
    if (local >= VIAJE * 0.55 || i >= N) enciende(Math.min(i + (local >= VIAJE * 0.55 ? 1 : 0), N));
    else enciende(i);

    mueveLuz(i, local);
    requestAnimationFrame(frame);
  }

  function quieto() {
    corriendo = false;
    if (raiz) raiz.classList.remove("ruta--viva");
    for (var k = 0; k < items.length; k++) items[k].classList.remove("is-on", "is-pasado");
    for (var m = 0; m < gDeps.children.length; m++) {
      gDeps.children[m].classList.remove("dep--vivo", "dep--visitado");
      gDeps.children[m].classList.add("dep--apagado");
    }
    for (var v = 0; v < puntos.length; v++) nodos[puntos[v].id].classList.remove("dep--apagado");
    nodos[puntos[0].id].classList.add("dep--vivo");
    pon(puntos[0].x, puntos[0].y);
    if (elEtiqueta) {
      elEtiqueta.textContent = puntos[0].nombre;
      elEtiqueta.setAttribute("x", puntos[0].x);
      elEtiqueta.setAttribute("y", puntos[0].y - 11);
    }
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
    /* siempre arranca en San Salvador, sin salto */
    t0 = performance.now();
    if (raiz) raiz.classList.add("ruta--viva");
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------- arranque --- */
  /* Los departamentos se encienden siempre, sin botón de pausa: con las
     animaciones del sistema apagadas (Windows lo trae así de fábrica) el mapa
     se quedaba congelado y parecía roto. Cada vuelta empieza en San
     Salvador y termina volviendo a él. */
  quieto();
  arranca();

  /* con la pestaña escondida el requestAnimationFrame se detiene: al volver
     se retoma desde San Salvador para que no salte a la mitad. */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) corriendo = false;
    else arranca();
  });
})();
