// Local preview of docs/ on port 5193. POST /__save-sample writes the PDF made in the browser to samples/ (local test run only).
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'docs');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf'};
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/__save-sample')) {
    const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'sample.pdf').replace(/[^\w .-]+/g, '');
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
      fs.mkdirSync(path.join(__dirname, 'samples'), {recursive: true});
      fs.writeFileSync(path.join(__dirname, 'samples', name), Buffer.concat(chunks)); res.end('ok');
    }); return;
  }
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
  fs.createReadStream(file).pipe(res);
}).listen(5193, '127.0.0.1', () => console.log('http://localhost:5193'));
