# Discord · monitor de visitas + panel privado

Todo esto ya está programado en el proyecto. Son 3 bloques de configuración
que solo vos podés hacer, porque son credenciales de tu cuenta.

| Pieza | Archivo | Para qué |
|---|---|---|
| Avisos | `netlify/functions/track.js` | Manda cada cosa a su canal: **ventas**, **tráfico** y **alertas** |
| Latido | `netlify/functions/latido.js` | Cada hora revisa sitio, registro y contadores; si algo cae, avisa a alertas |
| Panel | `netlify/functions/discord.js` | Comandos `/stats`, `/hoy`, `/online` dentro de Discord |
| Quién está online | `netlify/functions/online.js` | Lo que alimenta el contador de conectados |
| Resumen semanal | `netlify/functions/weekly.js` | Lunes 9:00 am, automático |

---

## 1. Los tres canales

Creá **tres canales** en tu servidor (los nombres son tuyos, sugiero estos):

| Canal | Qué llega | Variable en Netlify |
|---|---|---|
| `#ventas` | Pedidos por WhatsApp y carritos | `DISCORD_WEBHOOK_VENTAS` |
| `#trafico` | Cada visita, con equipo, ubicación y de dónde vino | `DISCORD_WEBHOOK_TRAFICO` |
| `#alertas` | Fallos del sitio o de los propios avisos | `DISCORD_WEBHOOK_ALERTAS` |

Para cada canal:

1. Discord → click derecho en el canal → **Editar canal** →
   **Integraciones** → **Webhooks** → **Nuevo webhook** → **Copiar URL**.
   Poné un nombre distinto a cada webhook (`Fayra Ventas`, `Fayra Tráfico`,
   `Fayra Alertas`) para reconocerlos después.
2. Netlify → **Site configuration** → **Environment variables** →
   **Add a variable**, una por canal con el nombre exacto de la tabla.
3. **Deploys** → **Trigger deploy** → *Deploy site*.

**Respaldo**: si creás uno solo, cargalo como `DISCORD_WEBHOOK_URL` y los
seis tipos caen ahí. Cada canal que configures se separa solo; los que no
existan siguen usando el general.

Prueba: abrí el sitio en el celular → tiene que llegar la visita a
`#trafico`. Agregá algo al carrito → a `#ventas`.

> El aviso de **«no pude avisar a Discord»** aparece en `#alertas` cuando un
> canal responde con error (webhook borrado, canal eliminado, Discord
> caído). Antes ese fallo se perdía en silencio: parecía que nadie visitaba
> el sitio. Si el que falla es el propio canal de alertas, no se avisa (no
> hay a dónde, y sería un bucle).

---

## 2. Panel dentro de Discord (comandos `/stats`, `/hoy`, `/online`, `/canales`)

Esto **no es un bot corriendo 24/7**: Discord le pega a una función de
Netlify cada vez que escribís un comando. Si nadie escribe, no corre nada.

### 2.1 Crear la aplicación

1. Entrá a <https://discord.com/developers/applications> → **New Application**.
2. Nombre: `Fayra Panel` → **Create**.

### 2.2 Conectar el endpoint (esto activa la seguridad)

1. En el menú izquierdo: **General Information**.
2. Copiá el **Public Key** (64 caracteres en hex).
3. En Netlify → **Environment variables** → agregá:
   - `DISCORD_PUBLIC_KEY` = la clave pública
4. Volvé a **Deploys → Trigger deploy** (sin esto la función arranca sin
   la clave y rechaza todo).
5. En el portal de Discord, campo **Interactions Endpoint URL**, pegá:

   ```
   https://fayraparfumsv.netlify.app/.netlify/functions/discord
   ```

6. **Save Changes**. Discord manda un `PING` y espera `PONG`.
   Si dice *"The specified interactions endpoint URL could not be verified"*,
   es porque el paso 4 todavía no terminó o la URL está mal escrita.

### 2.3 Crear los tres comandos

En el portal → **General Information** no; andá a la sección de comandos
del menú izquierdo (**Commands** / viejo *Bot → Slash Commands*) y creá uno
por uno. Todos de tipo **CHAT_INPUT** y sin opciones:

| Name | Description (obligatoria, 1–100 caracteres) |
|---|---|
| `stats` | Resumen de la semana: visitas, celular vs PC, clics y carritos |
| `hoy` | Visitas, clics y pedidos de hoy |
| `online` | Quién está ahora mismo en el sitio |
| `canales` | Revisa que los tres webhooks estén conectados y dice cuál falta |

> Los nombres van en minúscula y sin `/`. Discord los muestra como `/stats`.

### 2.4 Instalar la app en tu servidor

1. Menú izquierdo → **OAuth2** → **URL Generator**.
2. Scopes: marcá **`applications.commands`** (y `bot` solo si algún día
   querés que la app esté en el servidor como usuario).
3. Copiá la URL que aparece abajo, abrila y elegí **tu servidor**.

### 2.5 Que solo la veas vos (importante)

Sin esto, cualquiera que esté en el servidor puede correr los comandos.

1. Escribí `/stats` en tu servidor con tu usuario.
2. Menú de Discord → **Configuración de usuario** → **Avanzado** →
   activá **Modo desarrollador**.
3. Click derecho sobre tu nombre → **Copiar ID de usuario**.
4. Netlify → variable `DISCORD_ALLOW_USERS` = ese ID.
   Podés poner varios separados por coma.
5. **Deploys → Trigger deploy**.

Además, las respuestas son **efímeras**: solo las ve quien escribió el
comando y no quedan en el historial del canal.

---

## Qué datos usa cada comando

| Comando | Fuente | ¿Funciona ya? |
|---|---|---|
| `/stats` | Abacus (contadores de la semana) | **Sí**, no necesita nada |
| `/hoy` | Abacus (contadores del día) + Blobs si está | **Sí** |
| `/online` | Blobs (`online`) | No: falta configurar Blobs |
| `/canales` | los propios webhooks de Discord | **Sí**, no necesita nada |
| Aviso de caída | `latido.js`, cada hora (minuto 5) | **Sí**, con `DISCORD_WEBHOOK_ALERTAS` |

### Lo de Blobs (opcional)

`/online` y las secciones de "de dónde vienen" / "páginas más vistas" leen
Netlify Blobs, que hoy responde:

> `The environment has not been configured to use Netlify Blobs`

Para habilitarlo hacen falta dos variables en Netlify:

- `NETLIFY_SITE_ID` → **Site configuration → General → Site ID**
- `NETLIFY_BLOBS_TOKEN` → **User settings → Applications → Personal
  access tokens → New access token**

Sin eso, la tienda y los comandos `/stats` y `/hoy` andan igual.

---

## Cómo comprobar que quedó bien

1. **Avisos**: entrá al sitio → tiene que llegar el mensaje de visita.
2. **Pedido**: agregá al carrito y tocá "Pedir por WhatsApp" → llega
   "🚨 ¡Pedido por WhatsApp!" con producto, total y ubicación.
3. **Comando**: escribí `/stats` en el canal → tarjeta privada con la
   semana en curso. Si sale "No estás autorizado", revisá
   `DISCORD_ALLOW_USERS`.
4. **Latido**: abrí en el navegador
   `https://fayraparfumsv.netlify.app/.netlify/functions/latido`. Tiene que
   devolver `{"ok":true,"revisado":[...]}`. Si dice `ok:false`, el campo
   `problemas` dice qué no respondió, y `canalesSinConfigurar` qué
   variables faltan.
5. **Sin firma**: un POST normal a la URL del endpoint tiene que devolver
   `401 firma inválida`. Si devuelve `503 falta DISCORD_PUBLIC_KEY`, la
   clave todavía no está cargada en Netlify (o falta el redeploy después
   de cargarla): eso es lo que hace que Discord no acepte la URL al
   guardarla.

---

## Reglas de Discord que conviene saber

- **5 mensajes cada 2 segundos** por webhook. El código actual no
  reintenta: si se satura, ese aviso se pierde (el sitio sigue igual).
- **3 segundos** para responder una interacción. Por eso `/stats` corta la
  lectura de contadores a 2.3 s y responde con lo que tenga.
- El webhook es una **credencial**: quien lo tenga puede escribir en tu
  canal. Nunca va en el HTML ni en el repositorio, solo en Netlify.
