import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BODY = 8 * 1024 * 1024;
const LIMITS = { author: 60, title: 120, notes: 2000, place: 120, taxon: 120, text: 1000 };
export async function createApp({ dataDir = process.env.DATA_DIR || resolve(root, 'data') } = {}) {
  await mkdir(dataDir, { recursive: true });
  const file = resolve(dataDir, 'observations.json');
  let observations;
  try { observations = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; observations = []; }
  if (!Array.isArray(observations)) throw new Error('Invalid observations data');
  let writes = Promise.resolve();
  async function save() {
    const snapshot = JSON.stringify(observations, null, 2);
    const next = writes.catch(() => {}).then(async () => {
      await writeFile(file + '.tmp', snapshot);
      await rename(file + '.tmp', file);
    });
    writes = next; await next;
  }
  const origins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://localhost', 'https://localhost', 'capacitor://localhost', ...(process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)]);
  function clean(data, field, required = false) {
    const value = typeof data[field] === 'string' ? data[field].trim() : '';
    if ((required && !value) || value.length > LIMITS[field]) throw Object.assign(new Error(`Campo inválido: ${field}`), { status: 400 });
    return value;
  }
  async function body(req) {
    let size = 0; const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw Object.assign(new Error('Imagem muito grande. Use uma foto menor.'), { status: 413 });
      chunks.push(chunk);
    }
    try { const value = JSON.parse(Buffer.concat(chunks).toString()); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; }
    catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }); }
  }
  const server = http.createServer(async (req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const origin = req.headers.origin;
      const sameOrigin = origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`;
      if (origin && !sameOrigin && !origins.has(origin)) return send(403, { error: 'Origem não autorizada' });
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/api/health' && req.method === 'GET') return send(200, { status: 'ok', mode: 'local-prototype', ai: 'not-configured' });
      if (path === '/api/observations' && req.method === 'GET') return send(200, observations.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)));
      if (path === '/api/observations' && req.method === 'POST') {
        const data = await body(req);
        const fields = Object.fromEntries(['author', 'title', 'notes', 'place', 'taxon'].map(key => [key, clean(data, key, ['author', 'title', 'place'].includes(key))]));
        if (typeof data.photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(data.photo)) return send(400, { error: 'Envie uma foto JPG, PNG ou WebP.' });
        let location = null;
        if (data.location != null) {
          const { lat, lng } = data.location;
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return send(400, { error: 'Localização inválida' });
          // Never persist precise coordinates. Public precision is about 11 km latitude.
          location = { lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10 };
        }
        const observation = { id: randomUUID(), ...fields, photo: data.photo, location, createdAt: new Date().toISOString(), status: 'Aguardando revisão', identificationSource: fields.taxon ? 'Sugestão do observador' : 'Não identificada', comments: [] };
        observations.push(observation); await save(); return send(201, observation);
      }
      const match = path.match(/^\/api\/observations\/([^/]+)\/comments$/);
      if (match && req.method === 'POST') {
        const data = await body(req); const author = clean(data, 'author', true); const text = clean(data, 'text', true);
        const observation = observations.find(item => item.id === match[1]);
        if (!observation) return send(404, { error: 'Observação não encontrada' });
        observation.comments.push({ id: randomUUID(), author, text, createdAt: new Date().toISOString() });
        await save(); return send(201, observation);
      }
      if (path.startsWith('/api/')) return send(404, { error: 'Rota não encontrada' });
      if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: 'Método não permitido' });
      const relative = decodeURIComponent(path).replace(/^\/+/, '');
      const target = resolve(root, 'dist', relative || 'index.html');
      if (!target.startsWith(resolve(root, 'dist') + '/') && target !== resolve(root, 'dist')) return send(403, { error: 'Acesso negado' });
      let content, extension = extname(target);
      try { content = await readFile(target); }
      catch (error) {
        if (!['ENOENT', 'EISDIR'].includes(error.code)) throw error;
        if (extname(relative)) return send(404, { error: 'Arquivo não encontrado' });
        try { content = await readFile(resolve(root, 'dist/index.html')); extension = '.html'; }
        catch { return send(503, { error: 'Execute npm run build ou use npm run dev.' }); }
      }
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' })[extension] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) { if (error.status) send(error.status, { error: error.message }); else { console.error(error); send(500, { error: 'Não foi possível salvar ou carregar os dados.' }); } }
  });
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createApp();
  server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log(`DataBee API disponível na porta ${process.env.PORT || 3001}`));
}
