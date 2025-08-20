// server.js (production-ready)
const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const DEFAULT_INTERVAL = Number(process.env.DEFAULT_INTERVAL || 1500);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

// Simple mock generator — tweak as you like
const KEY_NAMES = [
    'temperature',
    'humidity',
    'pressure',
    'vibration',
    'voltage',
    'current',
    'speed',
    'altitude'
];

function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function unitFor(key) {
    switch (key) {
        case 'temperature': return '°C';
        case 'humidity': return '%';
        case 'pressure': return 'hPa';
        case 'vibration': return 'mm/s';
        case 'voltage': return 'V';
        case 'current': return 'A';
        case 'speed': return 'km/h';
        case 'altitude': return 'm';
        default: return '';
    }
}

function generateValue(key) {
    switch (key) {
        case 'temperature': return +(20 + Math.random() * 15).toFixed(2);
        case 'humidity': return +(30 + Math.random() * 50).toFixed(2);
        case 'pressure': return +(950 + Math.random() * 100).toFixed(2);
        case 'vibration': return +(Math.random() * 10).toFixed(2);
        case 'voltage': return +(200 + Math.random() * 20).toFixed(2);
        case 'current': return +(1 + Math.random() * 10).toFixed(2);
        case 'speed': return +(50 + Math.random() * 100).toFixed(2);
        case 'altitude': return +(100 + Math.random() * 500).toFixed(2);
        default: return Math.random();
    }
}

function buildReading({ assetId, keys }) {
    const keyName = randomFrom(keys);
    const value = generateValue(keyName);
    return {
        assetId,
        telemetry: [
            {
                value,
                name: keyName,
                type: typeof value,
                unit: unitFor(keyName),
                timestamp: Date.now(),
            },
        ],
        keyName,
    };
}

// HTTP app (health, version, simple index)
const app = express();
app.use(cors());
app.disable('x-powered-by');

app.get('/healthz', (req, res) => res.send('ok'));
app.get('/version', (req, res) => res.json({ version: '1.0.0' }));
app.get('/', (req, res) => {
    res.type('text').send(
        `IoT Socket Studio – Mock WebSocket\n` +
        `Connect: ws://${req.headers.host}/ws?assetId=02i9K000005B4tcQAC&interval=${DEFAULT_INTERVAL}&keys=temperature,humidity\n`
    );
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

function enforceOrigin(ws, req) {
    if (!ALLOWED_ORIGINS.length) return true;
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    try { ws.close(1008, 'Origin not allowed'); } catch { }
    return false;
}

wss.on('connection', (ws, req) => {
    if (!enforceOrigin(ws, req)) return;

    // Parse per-connection query params
    const url = new URL(req.url, `http://${req.headers.host}`);
    const interval = Math.max(200, Number(url.searchParams.get('interval') || DEFAULT_INTERVAL));
    const assetId = url.searchParams.get('assetId') || '02i9K000005B4tcQAC';
    const keys = (url.searchParams.get('keys') || KEY_NAMES.join(','))
        .split(',')
        .map(s => s.trim())
        .filter(s => KEY_NAMES.includes(s));
    const count = Math.min(5, Math.max(1, Number(url.searchParams.get('count') || 1)));

    ws.send(JSON.stringify({ type: 'hello', interval, assetId, keys, count }));

    // Per-connection broadcaster
    let closed = false;
    const tick = () => {
        if (closed || ws.readyState !== ws.OPEN) return;
        for (let i = 0; i < count; i++) ws.send(JSON.stringify(buildReading({ assetId, keys })));
    };
    const intervalHandle = setInterval(tick, interval);

    // Per-connection keepalive
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    const keepaliveHandle = setInterval(() => {
        if (!ws.isAlive) { try { ws.terminate(); } catch { } return; }
        ws.isAlive = false; try { ws.ping(); } catch { }
    }, 15000);

    ws.on('message', (msg) => {
        // Optional: echo or handle control messages
        // ws.send(JSON.stringify({ type: 'echo', data: msg.toString() }));
    });

    ws.on('close', () => {
        closed = true;
        clearInterval(intervalHandle);
        clearInterval(keepaliveHandle);
    });
    ws.on('error', () => {
        closed = true;
        clearInterval(intervalHandle);
        clearInterval(keepaliveHandle);
    });
});

server.listen(PORT, () => {
    console.log(`HTTP  : http://0.0.0.0:${PORT}`);
    console.log(`WS    : ws://0.0.0.0:${PORT}/ws`);
    console.log(`Default interval: ${DEFAULT_INTERVAL} ms`);
});

// Graceful shutdown
function shutdown() {
    console.log('\nShutting down…');
    try {
        wss.clients.forEach((ws) => { try { ws.terminate(); } catch { } });
    } catch { }
    server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);