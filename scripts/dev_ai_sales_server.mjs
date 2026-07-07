import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRequestPost as coachPost } from '../functions/api/ai-sales/coach.js';
import { onRequestGet as healthGet } from '../functions/api/ai-sales/health.js';
import { onRequestPost as transcribePost } from '../functions/api/ai-sales/transcribe.js';
import { onRequestPost as turnPost } from '../functions/api/ai-sales/turn.js';
import { onRequestPost as ttsPost } from '../functions/api/ai-sales/tts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const port = Number(process.argv[2] || 8788);

const contentTypes = {
        '.css': 'text/css; charset=utf-8',
        '.glb': 'model/gltf-binary',
        '.html': 'text/html; charset=utf-8',
        '.ico': 'image/x-icon',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function readEnvFile(filePath) {
        if (!fs.existsSync(filePath)) return {};
        const env = {};

        fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach(rawLine => {
                const line = rawLine.trim();
                if (!line || line.startsWith('#') || !line.includes('=')) return;

                const index = line.indexOf('=');
                const key = line.slice(0, index).trim();
                let value = line.slice(index + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                }
                if (key) env[key] = value;
        });

        return env;
}

const env = {
        ...readEnvFile(path.join(root, '.dev.vars')),
        ...readEnvFile(path.join(root, 'ai-sales', '.env')),
        CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '215a936bbe84f807d69a113fbbd125fe',
        CLOUDFLARE_DEEPSEEK_MODEL: process.env.CLOUDFLARE_DEEPSEEK_MODEL || 'deepseek/deepseek-v4-pro',
        DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
        AI_SALES_TRANSCRIBE_MODEL: process.env.AI_SALES_TRANSCRIBE_MODEL || '@cf/openai/whisper',
        AI_SALES_TTS_MODEL: process.env.AI_SALES_TTS_MODEL || '@cf/deepgram/aura-2-en',
        AI_SALES_TTS_SPEAKER: process.env.AI_SALES_TTS_SPEAKER || 'apollo',
        AI_SALES_WORKERS_MODEL: process.env.AI_SALES_WORKERS_MODEL || '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
        ...process.env
};

function nodeHeaders(headers) {
        const output = new Headers();
        Object.entries(headers).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                        value.forEach(item => output.append(key, item));
                } else if (value !== undefined) {
                        output.set(key, value);
                }
        });
        return output;
}

function readBody(req) {
        return new Promise((resolve, reject) => {
                const chunks = [];
                req.on('data', chunk => chunks.push(chunk));
                req.on('end', () => resolve(Buffer.concat(chunks)));
                req.on('error', reject);
        });
}

async function sendFetchResponse(res, response) {
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
}

function safeStaticPath(urlPath) {
        const decoded = decodeURIComponent(urlPath);
        const relativePath = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
        const filePath = path.normalize(path.join(distDir, relativePath));
        if (!filePath.startsWith(distDir)) return null;
        return filePath;
}

function serveStatic(req, res, urlPath) {
        let filePath = safeStaticPath(urlPath);
        if (!filePath) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
                filePath = path.join(filePath, 'index.html');
        }

        if (!fs.existsSync(filePath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Not found');
                return;
        }

        const ext = path.extname(filePath);
        res.writeHead(200, {
                'Content-Type': contentTypes[ext] || 'application/octet-stream',
                'Cache-Control': 'no-store'
        });
        fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, url) {
        const request = new Request(`http://127.0.0.1:${port}${url.pathname}${url.search}`, {
                method: req.method,
                headers: nodeHeaders(req.headers),
                body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
        });

        if (url.pathname === '/api/ai-sales/coach' && req.method === 'POST') {
                await sendFetchResponse(res, await coachPost({ request, env }));
                return true;
        }

        if (url.pathname === '/api/ai-sales/health' && req.method === 'GET') {
                await sendFetchResponse(res, await healthGet({ request, env }));
                return true;
        }

        if (url.pathname === '/api/ai-sales/turn' && req.method === 'POST') {
                await sendFetchResponse(res, await turnPost({ request, env }));
                return true;
        }

        if (url.pathname === '/api/ai-sales/transcribe' && req.method === 'POST') {
                await sendFetchResponse(res, await transcribePost({ request, env }));
                return true;
        }

        if (url.pathname === '/api/ai-sales/tts' && req.method === 'POST') {
                await sendFetchResponse(res, await ttsPost({ request, env }));
                return true;
        }

        return false;
}

const server = http.createServer(async (req, res) => {
        try {
                const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
                if (url.pathname.startsWith('/api/')) {
                        const handled = await handleApi(req, res, url);
                        if (handled) return;
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Not found' }));
                        return;
                }

                serveStatic(req, res, url.pathname);
        } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
        }
});

server.listen(port, '127.0.0.1', () => {
        console.log(`AI Sales dev server running at http://127.0.0.1:${port}/ai-sales/`);
});
