// server.js
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 15000); // 1s default

const server = http.createServer();
const wss = new WebSocketServer({ server });

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

function mockReading() {
    const keyName = randomFrom(KEY_NAMES);
    const value = generateValue(keyName);
    return {
        assetId: '02i9K000005B4tcQAC',
        telemetry: [
            {
                value: value,
                name: keyName,
                type: typeof value,
                unit: unitFor(keyName),
                timestamp: Date.now()
            }
        ],
        keyName: keyName
    };
}

// Broadcast helper
function broadcast(obj) {
    const data = JSON.stringify(obj);
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) client.send(data);
    });
}

// Keepalive (helps some proxies)
const KEEPALIVE_MS = 15000;
function heartbeat() { this.isAlive = true; }

wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    console.log('[WS] client connected from', req.socket.remoteAddress);
    ws.send(JSON.stringify({ type: 'hello', msg: 'connected', intervalMs: INTERVAL_MS }));
});

// Periodic broadcaster
const interval = setInterval(() => {
    broadcast(mockReading());
}, INTERVAL_MS);

// Ping clients for keepalive + terminate dead sockets
const pingTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, KEEPALIVE_MS);

wss.on('close', () => {
    clearInterval(interval);
    clearInterval(pingTimer);
});

server.listen(PORT, () => {
    console.log(`WS server running at ws://localhost:${PORT} (interval ${INTERVAL_MS} ms)`);
});

// Graceful shutdown
function shutdown() {
    console.log('\nShutting down…');
    clearInterval(interval);
    clearInterval(pingTimer);
    wss.close(() => server.close(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);