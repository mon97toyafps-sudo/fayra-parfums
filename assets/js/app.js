/* ============================================================
   FAYRA PARFUMS — lógica compartida por todas las páginas
   ============================================================ */
(function () {
  "use strict";

  /* ------------------------------------------------------------
     NÚMERO DE WHATSAPP
     Cambialo acá y se actualiza en toda la página y en los
     mensajes de pedido.
     Formato: código de país + número, sin +, sin guiones ni espacios.
     ------------------------------------------------------------ */
  var WA = "50363012305";

  /* ------------------------------------------------------------
     PRODUCTOS
     Para agregar un perfume nuevo, copiá un bloque de abajo y
     cambiale los datos. La página de catálogo los muestra solo.
     ------------------------------------------------------------ */
  var PRODUCTS = [
    {
      id: "odyssey-aqua",
      brand: "Armaf",
      name: "Odyssey Aqua",
      size: "100 ml EDP",
      price: 64.99,
      image: "assets/img/perfume-1.jpg",
      gallery: [
        "assets/img/perfume-1.jpg",
        "assets/img/perfume-2.webp",
        "assets/img/odyssey-ingredientes.jpg",
        "assets/img/odyssey-ficha.jpg"
      ],
      tags: ["Hombre", "Fresco"],
      short: "Fresco, acuático y cítrico: la frescura del mar en cada atomización.",
      long: "Fresco, acuático y cítrico: la frescura del mar en cada atomización. Abre con cítricos jugosos y notas marinas, se vuelve aromática en el corazón y termina en un fondo limpio de maderas y almizcle. Perfecta para el día a día, la oficina o una salida casual.",
      sale: ["Toronja", "Mandarina", "Notas marinas"],
      heart: ["Lavanda", "Geranio", "Salvia"],
      base: ["Ambroxan", "Almizcle", "Cedro"]
    }
    /*
    ,{
      id: "otro-perfume",
      brand: "Marca",
      name: "Nombre",
      size: "100 ml EDP",
      price: 0.00,
      image: "assets/img/otro.jpg",
      gallery: ["assets/img/otro.jpg"],
      tags: ["Hombre"],
      short: "Descripción corta para la tarjeta.",
      long: "Descripción larga para la ventana de detalle.",
      sale: ["Nota 1", "Nota 2"],
      heart: ["Nota 3"],
      base: ["Nota 4"]
    }
    */
  ];

  var WA_GREETING = "Hola, Fayra Parfums.";
  var money = function (n) { return "$" + n.toFixed(2); };
  var $ = function (id) { return document.getElementById(id); };
  var existe = function (id) { return !!document.getElementById(id); };

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fino = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function waLink(msg) { return "https://wa.me/" + WA + "?text=" + encodeURIComponent(msg); }
  function waHref(msg) { return msg ? waLink(msg) : "https://wa.me/" + WA; }

  /* ---------- Carrito (persistente entre páginas) ---------- */
  var cart = [];
  try { cart = JSON.parse(localStorage.getItem("fayra-cart")) || []; } catch (e) { cart = []; }
  function save() { try { localStorage.setItem("fayra-cart", JSON.stringify(cart)); } catch (e) {} }
  function total() { return cart.reduce(function (s, it) { return s + it.qty * it.price; }, 0); }
  function count() { return cart.reduce(function (s, it) { return s + it.qty; }, 0); }

  function orderMessage(items) {
    var lines = ["Hola, Fayra Parfums. Me gustaría realizar el siguiente pedido:", ""];
    items.forEach(function (it) {
      lines.push(it.name + " " + it.size);
      lines.push("Cantidad: " + it.qty);
      lines.push("Precio: " + money(it.price));
      lines.push("");
    });
    lines.push("Total: " + money(items.reduce(function (s, it) { return s + it.qty * it.price; }, 0)));
    lines.push("");
    lines.push("Quisiera confirmar disponibilidad y coordinar mi pedido.");
    return lines.join("\n");
  }

  /* ============================================================
     ANIMACIONES Y DETALLES DE TODA LA PÁGINA
     ============================================================ */
  var pv = existe("productView") ? $("productView") : null;
  var drawer = existe("cartDrawer") ? $("cartDrawer") : null;
  var overlay = existe("cartOverlay") ? $("cartOverlay") : null;
  var burger = existe("burger") ? $("burger") : null;
  var menu = existe("mobileMenu") ? $("mobileMenu") : null;
  var qty = 1;

  function syncLock() {
    var abierto = (pv && pv.classList.contains("open")) || (drawer && drawer.classList.contains("open")) || (menu && menu.classList.contains("open"));
    document.body.classList.toggle("no-scroll", !!abierto);
  }

  function arrancar() { document.body.classList.add("ready"); }
  if (document.readyState === "complete") arrancar();
  else window.addEventListener("load", arrancar);
  setTimeout(arrancar, 1400); /* red lenta: nunca quedamos en blanco */

  /* Header compacto + barra de progreso + parallax del hero */
  var header = existe("header") ? $("header") : null;
  var progress = existe("progress") ? $("progress") : null;
  var heroVisual = document.querySelector(".hero__visual");
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset;
    if (header) header.classList.toggle("stuck", y > 40);
    if (progress) {
      var alto = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = "scaleX(" + (alto > 0 ? Math.min(y / alto, 1) : 0) + ")";
    }
    if (!reduced && heroVisual && y < window.innerHeight * 1.2) {
      heroVisual.style.transform = "translate3d(0," + (y * 0.11).toFixed(1) + "px,0)";
    }
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* Animaciones al hacer scroll */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
    });
  }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
  Array.prototype.forEach.call(document.querySelectorAll(".reveal"), function (el) { io.observe(el); });

  /* Preguntas frecuentes: abrir y cerrar */
  Array.prototype.forEach.call(document.querySelectorAll(".faq__q"), function (btn) {
    btn.addEventListener("click", function () {
      var abierto = btn.getAttribute("aria-expanded") === "true";
      Array.prototype.forEach.call(document.querySelectorAll(".faq__q"), function (otro) {
        otro.setAttribute("aria-expanded", "false");
        otro.nextElementSibling.style.maxHeight = null;
      });
      if (abierto) return;
      btn.setAttribute("aria-expanded", "true");
      var panel = btn.nextElementSibling;
      panel.style.maxHeight = panel.scrollHeight + "px";
    });
  });

  /* Efectos de escritorio: brillo que sigue al cursor, inclinar tarjetas */
  if (fino && !reduced) {
    if (existe("cursor")) {
      var cursor = $("cursor"), cx = 0, cy = 0, tx = 0, ty = 0;
      window.addEventListener("pointermove", function (e) {
        document.body.classList.add("has-cursor");
        tx = e.clientX; ty = e.clientY;
      }, { passive: true });
      (function mover() {
        cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
        cursor.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
        requestAnimationFrame(mover);
      })();
    }
    [$("card"), existe("heroFrame") ? $("heroFrame") : null].forEach(function (el) {
      if (!el) return;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = "perspective(1100px) rotateY(" + (px * 7).toFixed(2) + "deg) rotateX(" + (-py * 7).toFixed(2) + "deg)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* ============================================================
     MONITOR Y CONTADOR (todas las páginas)
     ============================================================ */
  function sendEvent(data) {
    var host = location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "") return;
    try {
      data.path = location.pathname;
      fetch("/.netlify/functions/track", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).catch(function () {});
    } catch (e) {}
  }
  sendEvent({ type: "visit", ref: document.referrer || "" });

  (function () {
    var el = $("visitas");
    if (!el) return;
    fetch("https://abacus.jasoncameron.dev/hit/fayraparfumsv.netlify.app/visitas")
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (d) {
        var objetivo = Number(d.value) || 0;
        if (reduced) { el.textContent = objetivo.toLocaleString("es-SV"); return; }
        var actual = 0, paso = Math.max(1, Math.round(objetivo / 42));
        var reloj = setInterval(function () {
          actual += paso;
          if (actual >= objetivo) { actual = objetivo; clearInterval(reloj); }
          el.textContent = actual.toLocaleString("es-SV");
        }, 26);
      })
      .catch(function () { var row = $("visitRow"); if (row) row.style.display = "none"; });
  })();

  (function () {
    try {
      document.addEventListener("click", function (ev) {
        var a = ev.target.closest ? ev.target.closest("a") : null;
        var b = ev.target.closest ? ev.target.closest("button") : null;
        var el = a || b;
        if (!el) return;
        var src = "otro";
        if (el.classList.contains("wa-float")) src = "flotante";
        else if (el.id === "cartWhats" || el.id === "pvWhats") src = "carrito-whatsapp";
        else if (el.id === "shareBtn") src = "compartir";
        else if (a && a.href.indexOf("instagram.com") !== -1) src = "instagram";
        else if (a && a.href.indexOf("wa.me") !== -1) src = "whatsapp-texto";
        else if (el.classList.contains("add-cart")) src = "agregar-carrito";
        else if (el.classList.contains("ver-detalle")) src = "ver-producto";
        if (src === "otro") return;
        sendEvent({ type: "click", source: src });
      }, true);
    } catch (e) {}
  })();

  (function () {
    var host = location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "") return;
    var sid = null;
    try { sid = sessionStorage.getItem("fayra_sid"); } catch (e) {}
    if (!sid) {
      sid = "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
      try { sessionStorage.setItem("fayra_sid", sid); } catch (e) {}
    }
    function ping() {
      try {
        fetch("/.netlify/functions/online", {
          method: "POST", keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sid: sid, path: location.pathname })
        }).catch(function () {});
      } catch (e) {}
    }
    ping();
    setInterval(ping, 30000);
  })();

  /* ---------- Compartir ---------- */
  (function () {
    var btn = $("shareBtn"), txt = $("shareTxt");
    if (!btn) return;
    var url = "https://fayraparfumsv.netlify.app/";
    var data = {
      title: "Fayra Parfums · Perfumes originales en El Salvador",
      text: "Perfumes originales importados. Envío incluido en el precio, a todo El Salvador.",
      url: url
    };
    btn.addEventListener("click", function () {
      if (navigator.share) { navigator.share(data).catch(function () {}); }
      else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          if (txt) txt.textContent = "Link copiado ✓";
          setTimeout(function () { if (txt) txt.textContent = "Compartir Fayra Parfums"; }, 2200);
        }).catch(function () {});
      }
    });
  })();

  /* ============================================================
     MENÚ MÓVIL
     ============================================================ */
  if (burger && menu) {
    function closeMenu() {
      burger.classList.remove("open");
      menu.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
      syncLock();
    }
    burger.addEventListener("click", function () {
      var abierto = menu.classList.toggle("open");
      burger.classList.toggle("open", abierto);
      burger.setAttribute("aria-expanded", String(abierto));
      syncLock();
    });
    Array.prototype.forEach.call(menu.querySelectorAll("a"), function (a) {
      a.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  }

  /* ============================================================
     CARRITO
     ============================================================ */

  /* En la portada el carrito es un enlace al catálogo: solo pintamos el
     número de productos para que el cliente sepa que tiene algo guardado. */
  if (!drawer && existe("cartCount")) {
    var badgeSolo = $("cartCount");
    var n = count();
    badgeSolo.textContent = n;
    badgeSolo.classList.toggle("show", n > 0);
  }

  /* Estas funciones viven fuera del "if (drawer)" a propósito: en modo estricto
     las funciones declaradas dentro de un bloque quedan encerradas en él, y el
     botón "Agregar" del catálogo la necesita desde afuera. Cada una revisa que
     existan sus elementos antes de tocar el DOM, para que también sirvan en la
     portada, donde no hay carrito. */
  function openCart() {
    if (!drawer) return;
    drawer.classList.add("open");
    if (overlay) overlay.classList.add("open");
    syncLock();
  }
  function closeCart() {
    if (!drawer) return;
    drawer.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
    syncLock();
  }

  function render() {
      var list = $("cartList");
      if (!list) return;
      list.innerHTML = "";

      if (cart.length === 0) {
        var empty = document.createElement("div");
        empty.className = "drawer__empty";
        empty.innerHTML = "<p>Tu pedido está vacío.</p><small>Agrega un perfume desde el catálogo.</small>";
        var go = document.createElement("a");
        go.className = "btn btn--ghost btn--sm";
        go.href = "catalogo.html";
        go.textContent = "Ver catálogo";
        go.addEventListener("click", closeCart);
        empty.appendChild(go);
        list.appendChild(empty);
      } else {
        cart.forEach(function (item, i) {
          var row = document.createElement("div");
          row.className = "cart-item";

          var img = document.createElement("img");
          img.className = "cart-item__img";
          img.src = item.image;
          img.alt = item.name;

          var body = document.createElement("div");

          var brand = document.createElement("p");
          brand.className = "cart-item__brand";
          brand.textContent = item.brand;

          var name = document.createElement("p");
          name.className = "cart-item__name";
          name.textContent = item.name;

          var size = document.createElement("p");
          size.className = "cart-item__size";
          size.textContent = item.size;

          var rowB = document.createElement("div");
          rowB.className = "cart-item__row";

          var qtyBox = document.createElement("div");
          qtyBox.className = "qty";

          var minus = document.createElement("button");
          minus.type = "button";
          minus.textContent = "−";
          minus.setAttribute("aria-label", "Quitar uno");
          minus.addEventListener("click", function () { change(i, -1); });

          var amount = document.createElement("span");
          amount.className = "qty__val";
          amount.textContent = item.qty;

          var plus = document.createElement("button");
          plus.type = "button";
          plus.textContent = "+";
          plus.setAttribute("aria-label", "Agregar uno");
          plus.addEventListener("click", function () { change(i, 1); });

          qtyBox.appendChild(minus);
          qtyBox.appendChild(amount);
          qtyBox.appendChild(plus);

          var price = document.createElement("span");
          price.className = "cart-item__price";
          price.textContent = money(item.price);

          rowB.appendChild(qtyBox);
          rowB.appendChild(price);

          var remove = document.createElement("button");
          remove.className = "cart-item__remove";
          remove.type = "button";
          remove.textContent = "Quitar";
          remove.setAttribute("aria-label", "Eliminar del pedido");
          remove.addEventListener("click", function () { removeAt(i); });

          body.appendChild(brand);
          body.appendChild(name);
          body.appendChild(size);
          body.appendChild(rowB);
          body.appendChild(remove);

          row.appendChild(img);
          row.appendChild(body);
          list.appendChild(row);
        });
      }

      $("cartTotal").textContent = money(total());
      var badge = $("cartCount");
      var c = count();
      badge.textContent = c;
      badge.classList.toggle("show", c > 0);
      $("cartWhats").href = cart.length ? waLink(orderMessage(cart)) : waHref(WA_GREETING);
      save();
    }

    function change(i, d) { cart[i].qty += d; if (cart[i].qty <= 0) cart.splice(i, 1); render(); }
    function removeAt(i) { cart.splice(i, 1); render(); }

    function addToCart(prod, qtyN) {
      var found = null;
      cart.forEach(function (it) { if (it.id === prod.id) found = it; });
      if (found) found.qty = Math.min(99, found.qty + qtyN);
      else cart.push({ id: prod.id, brand: prod.brand, name: prod.name, size: prod.size, price: prod.price, image: prod.image, qty: qtyN });

      render();
      var badge = $("cartCount");
      badge.classList.remove("bump");
      void badge.offsetWidth;
      badge.classList.add("bump");

      openCart();
      sendEvent({ type: "cart", detail: prod.name + " " + prod.size + " ×" + count(), total: money(total()) });
    }
    window.fayraAddToCart = addToCart;

    if (drawer) {
      $("cartOpen").addEventListener("click", openCart);
      $("cartClose").addEventListener("click", closeCart);
      $("cartClear").addEventListener("click", function () { cart = []; render(); });

      $("cartWhats").addEventListener("click", function () {
        if (!cart.length) return;
        sendEvent({
          type: "order",
          detail: cart.map(function (it) { return it.name + " " + it.size + " ×" + it.qty + " — " + money(it.qty * it.price); }).join("\n") + "\nTotal: " + money(total()),
          source: "Carrito 🛒"
        });
      });

      document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCart(); });
      render();

      /* Si se entró desde el botón del carrito de otra página, se abre solo */
      if (location.hash === "#mi-pedido" && count() > 0) openCart();
    }

  /* ============================================================
     CATÁLOGO + VENTANA DE DETALLE
     ============================================================ */
  var grid = $("catalogGrid");

  function pintarGrid() {
    if (!grid) return;
    grid.innerHTML = "";
    PRODUCTS.forEach(function (p, i) {
      var art = document.createElement("article");
      art.className = "card reveal";
      art.setAttribute("data-d", String(i % 4));
      art.innerHTML =
        '<div class="card__media ver-detalle" role="button" tabindex="0" aria-label="Ver detalle de ' + p.name + '">' +
          '<img src="' + p.image + '" alt="' + p.name + '" loading="lazy" />' +
          '<span class="badge badge--dark">Hombre</span>' +
          '<span class="badge badge--gold">Más vendido</span>' +
        '</div>' +
        '<div>' +
          '<p class="card__brand">' + p.brand + '</p>' +
          '<h3 class="card__name ver-detalle" role="button" tabindex="0">' + p.name + '</h3>' +
          '<p class="card__desc">' + p.short + '</p>' +
          '<div class="card__meta">' +
            p.tags.map(function (t) { return '<span class="chip">' + t + '</span>'; }).join("") +
          '</div>' +
          '<div class="card__bottom">' +
            '<span class="card__price">' + money(p.price) + '</span>' +
            '<span class="card__size">' + p.size + '</span>' +
            '<button class="btn btn--gold btn--sm add-cart" style="margin-left:auto">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>Agregar' +
            '</button>' +
          '</div>' +
        '</div>';

      var botonesDetalle = art.querySelectorAll(".ver-detalle");
      Array.prototype.forEach.call(botonesDetalle, function (el) {
        el.addEventListener("click", function () { openProduct(i); });
        el.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProduct(i); }
        });
      });
      art.querySelector(".add-cart").addEventListener("click", function () { addToCart(p, 1); });
      grid.appendChild(art);

      /* inclinación 3D en escritorio */
      if (fino && !reduced) {
        art.addEventListener("pointermove", function (e) {
          var r = art.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          art.style.transform = "perspective(1100px) rotateY(" + (px * 6).toFixed(2) + "deg) rotateX(" + (-py * 6).toFixed(2) + "deg)";
        });
        art.addEventListener("pointerleave", function () { art.style.transform = ""; });
      }
    });

    Array.prototype.forEach.call(grid.querySelectorAll(".reveal"), function (el) { io.observe(el); });
  }

  var prodActual = null;
  var galIndex = 0;

  function renderGaleria() {
    if (!prodActual) return;
    var lista = prodActual.gallery || [prodActual.image];
    $("pvImg").src = lista[galIndex];
    $("pvMedia").classList.remove("zoomed");
    $("pvCounter").textContent = (galIndex + 1) + " / " + lista.length;

    var muchas = lista.length > 1;
    $("pvPrev").style.display = muchas ? "grid" : "none";
    $("pvNext").style.display = muchas ? "grid" : "none";
    $("pvCounter").style.display = muchas ? "block" : "none";
    var thumbs = $("pvThumbs");
    thumbs.style.display = muchas ? "flex" : "none";
    thumbs.innerHTML = "";
    lista.forEach(function (src, i) {
      var t = document.createElement("button");
      t.type = "button";
      t.className = "pv__thumb" + (i === galIndex ? " active" : "");
      t.setAttribute("aria-label", "Foto " + (i + 1));
      var im = document.createElement("img");
      im.src = src; im.alt = "";
      t.appendChild(im);
      t.addEventListener("click", function () { galIndex = i; renderGaleria(); });
      thumbs.appendChild(t);
    });
  }

  function setQty(n) {
    if (!prodActual) return;
    qty = Math.max(1, Math.min(99, n));
    $("qtyVal").textContent = qty;
    $("pvPrice").textContent = money(prodActual.price * qty);
    $("pvWhats").href = waLink(orderMessage([{ name: prodActual.name, size: prodActual.size, price: prodActual.price, qty: qty }]));
  }

  function openProduct(i) {
    if (!pv) return;
    prodActual = PRODUCTS[i];
    if (!prodActual) return;
    galIndex = 0;
    $("pvBrand").textContent = prodActual.brand;
    $("pvName").textContent = prodActual.name;
    $("pvDesc").textContent = prodActual.long;
    $("pvTags").innerHTML = prodActual.tags.map(function (t) { return '<span class="chip">' + t + '</span>'; }).join("");
    $("pvNotes").innerHTML =
      '<div><h4>Salida</h4><ul>' + prodActual.sale.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>" +
      '<div><h4>Corazón</h4><ul>' + prodActual.heart.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>" +
      '<div><h4>Fondo</h4><ul>' + prodActual.base.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>";
    $("pvWhats").setAttribute("data-name", prodActual.name);
    renderGaleria();
    setQty(1);
    pv.classList.add("open");
    pv.setAttribute("aria-hidden", "false");
    pv.scrollTop = 0;
    syncLock();
  }

  if (pv && existe("pvMedia")) {
    renderGaleria = renderGaleria.bind(null);

    $("pvClose").addEventListener("click", function () {
      pv.classList.remove("open");
      pv.setAttribute("aria-hidden", "true");
      syncLock();
    });
    $("pvBack").addEventListener("click", function () {
      pv.classList.remove("open");
      pv.setAttribute("aria-hidden", "true");
      syncLock();
    });
    $("pvMedia").addEventListener("click", function () { this.classList.toggle("zoomed"); });
    $("qtyMinus").addEventListener("click", function () { setQty(qty - 1); });
    $("qtyPlus").addEventListener("click", function () { setQty(qty + 1); });
    $("pvPrev").addEventListener("click", function (e) {
      e.stopPropagation();
      var l = prodActual.gallery || [prodActual.image];
      galIndex = (galIndex - 1 + l.length) % l.length;
      renderGaleria();
    });
    $("pvNext").addEventListener("click", function (e) {
      e.stopPropagation();
      var l = prodActual.gallery || [prodActual.image];
      galIndex = (galIndex + 1) % l.length;
      renderGaleria();
    });
    $("pvAdd").addEventListener("click", function () { addToCart(prodActual, qty); setQty(1); });
    $("pvWhats").addEventListener("click", function () {
      if (!prodActual) return;
      sendEvent({
        type: "order",
        detail: prodActual.name + " " + prodActual.size + " ×" + qty + " — " + money(prodActual.price * qty),
        source: "Ventana del producto 🧴"
      });
    });

    /* deslizar con el dedo */
    var x0 = null;
    $("pvMedia").addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    $("pvMedia").addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) {
        var l = prodActual.gallery || [prodActual.image];
        galIndex = (galIndex + (dx < 0 ? 1 : -1) + l.length) % l.length;
        renderGaleria();
      }
      x0 = null;
    }, { passive: true });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && pv.classList.contains("open")) {
        pv.classList.remove("open");
        pv.setAttribute("aria-hidden", "true");
        syncLock();
      }
    });
  }

  pintarGrid();
})();
