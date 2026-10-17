# Discord · monitor de visitas + panel privado

Todo esto ya está programado en el proyecto. Son 3 bloques de configuración
que solo vos podés hacer, porque son credenciales de tu cuenta.

| Pieza | Archivo | Para qué |
|---|---|---|
| Avisos | `netlify/functions/track.js` | Avisa al instante: visita, carrito y **pedido por WhatsApp** |
| Panel | `netlify/functions/discord.js` | Comandos `/stats`, `/hoy`, `/online` dentro de Discord |
| Quién está online | `netlify/functions/online.js` | Lo que alimenta el contador de conectados |
| Resumen semanal | `netlify/functions/weekly.js` | Lunes 9:00 am, automático |

---

## 1. Avisos al instante (webhook)

1. Discord → tu servidor → click derecho en el canal → **Editar canal**
   → **Integraciones** → **Webhooks** → **Nuevo webhook** → **Copiar URL**.
2. Netlify → tu sitio → **Site configuration** → **Environment variables**
   → **Add a variable**:
   - Nombre: `DISCORD_WEBHOOK_URL`
   - Valor: la URL que copiaste
3. **Deploys** → **Trigger deploy** → *Deploy site*.

Prueba: abrí el sitio en el celular y mirá el canal. Debe llegar
"🛍️ Nueva visita a Fayra Parfums".

> Si querés separar el ruido: creá dos webhooks más y usá
> `DISCORD_WEBHOOK_VENTAS` y `DISCORD_WEBHOOK_TRAFICO`. El código ya
> prioriza el de ventas para `order`/`cart` si existe.

---

## 2. Panel dentro de Discord (comandos `/stats`, `/hoy`, `/online`)

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
4. **Sin firma**: un POST normal a la URL del endpoint tiene que devolver
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
