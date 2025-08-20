# IoT Socket Studio

Mock WebSocket **telemetry server** + minimal **web UI** for quickly testing IoT-style streams.

- **WebSocket endpoint:** `/ws`
- **Health:** `GET /healthz` → `ok`
- **Version:** `GET /version` → `{ version: "1.0.0" }`
- **HTTP preview:** `GET /preview` (returns one-shot mock payloads based on query params)

---

## Quick Start

### Prerequisites

- Node.js **v18+** (v20 recommended)

### Install & run

```bash
npm install
node server.js
# HTTP  : http://localhost:8080
# WS    : ws://localhost:8080/ws
```

Open the local UI at **`index.html`** (served if you host the file, or open directly in your browser). The UI includes:

- **Connect / Disconnect / Clear**
- **Generate Telemetry** button to auto-fill a sample payload in the textarea
- **Live log** with JSON syntax highlighting
- **Last Message** panel
- **Auto‑scroll** and **Wrap** toggles

> Tip: If you serve `index.html` from the same origin as the server, you can update the client connection to:
>
> ```js
> new WebSocket(`ws://${location.host}/ws`);
> ```

---

## WebSocket Usage

Connect to `/ws` and pass query parameters to control the stream.

**Example (browser):**

```js
const ws = new WebSocket(
  "ws://localhost:8080/ws?assetId=02i9K000005B4tcQAC&interval=1000&keys=temperature,humidity"
);
ws.onmessage = (e) => console.log("message:", e.data);
```

**Example (CLI):**

```bash
npx wscat -c "ws://localhost:8080/ws?interval=750&keys=temperature,voltage&count=2"
```

**Example (Node):**

```js
import WebSocket from "ws";
const ws = new WebSocket("ws://localhost:8080/ws?keys=vibration");
ws.on("message", (d) => console.log(d.toString()));
```

### Query Parameters

- `assetId` _(string)_ – defaults to `02i9K000005B4tcQAC`
- `keys` _(comma list)_ – choose any of:
  `temperature, humidity, pressure, vibration, voltage, current, speed, altitude`
- `interval` _(ms)_ – tick frequency (min **200**); defaults to `DEFAULT_INTERVAL` env (1500ms if unset)
- `count` _(1–5)_ – how many readings to send per tick

Each message looks like:

```json
{
  "assetId": "02i9K000005B4tcQAC",
  "telemetry": [
    {
      "value": 70.43,
      "name": "humidity",
      "type": "number",
      "unit": "%",
      "timestamp": 1755670215687
    }
  ],
  "keyName": "humidity"
}
```

The server also sends an initial hello:

```json
{
  "type": "hello",
  "interval": 1000,
  "assetId": "…",
  "keys": ["temperature", "humidity"],
  "count": 1
}
```

---

## HTTP Endpoints

- `GET /` – returns a text page with a **ready-to-use WS URL**. You can add query params to `/` to generate a tailored URL, e.g.
  ```
  /?assetId=MyAsset42&keys=temperature,voltage&interval=750&count=2
  ```
- `GET /preview` – returns one or more **sample payloads** without opening a WS connection (honors `assetId`, `keys`, `count`).
- `GET /healthz` – health probe
- `GET /version` – simple version JSON

---

## Configuration

Environment variables used by `server.js`:

- `PORT` – web/WS port (defaults to `8080` locally; on Azure this is provided)
- `DEFAULT_INTERVAL` – default interval in ms for connections that don’t pass `?interval` (default `1500`)
- `ALLOWED_ORIGINS` – optional **comma‑separated** list of allowed **browser** origins (if empty → allow any). Example:
  ```bash
  ALLOWED_ORIGINS="https://your-ui.example,https://another.app"
  ```

---

## Deploy

### Azure App Service (Web App)

1. Create a Linux Web App (Node 20), enable **WebSockets**, set health path `/healthz`.
2. Configure CI with GitHub Actions (Zip Deploy). Example step:
   ```yaml
   - uses: azure/webapps-deploy@v3
     with:
       app-name: iot-socket-studio-app
       publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
       package: build.zip
       enable-oryx-build: true
   ```
3. Connect at:
   ```
   wss://<your-app>.azurewebsites.net/ws
   ```

### Render (zero-cost dev)

- Create a **Web Service** → Build: `npm ci` → Start: `node server.js` → Health: `/healthz`
- Connect at `wss://<service>.onrender.com/ws`

> **Note:** GitHub Pages is static-only (no raw WebSockets). Host the UI there if you like, but point it to a WS host (Azure/Render/etc.).

---

## UI (index.html)

- Toolbar: **Connect**, **Disconnect**, **Clear**, **Auto‑scroll**, **Wrap**
- Right panel: **Last Message**, **Send (optional)** with textarea, **Generate Telemetry** button
- Footer: shows the **base WS URL** and a **runnable example** (auto‑filled from the current host)
- Styled like a code editor; JSON messages are syntax‑highlighted.

If you host UI and server together, you can also serve static files from Express:

```js
app.use(express.static(__dirname)); // serves index.html and /static/*
```

---

## Development

- Lint/format as you prefer.
- To change mock ranges/units, edit `generateValue()` and `unitFor()` in `server.js`.
- To add more keys, extend the `KEY_NAMES` array (also mirror in `index.html` for the UI mock button).

---

## License

MIT
