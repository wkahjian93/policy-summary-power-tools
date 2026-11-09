// Sync test only: serves docs/ on port 5194 and runs the REAL team server code (REDEFINE Form Filler/server/Code.gs)
// in memory at /gas, with Google services faked. Open http://localhost:5194 and http://127.0.0.1:5194 as two "devices"
// (different addresses keep separate storage). Team code here is "test-team-code". Nothing leaves this PC.
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, 'docs');
const props = {TEAM_CODE: 'test-team-code', OWNER_CODE: 'test-owner-code'};
const files = {};  // fake Drive folder: name -> text
const file = name => ({getName: () => name, getBlob: () => ({getDataAsString: () => files[name]}), setContent: t => { files[name] = t; }, setTrashed: () => { delete files[name]; }, getId: () => name});
const iter = list => { let i = 0; return {hasNext: () => i < list.length, next: () => list[i++]}; };
const folderObj = {getId: () => 'f', getFilesByName: n => iter(n in files ? [file(n)] : []), createFile: (n, t) => { files[n] = t; return file(n); },
  searchFiles: () => iter(Object.keys(files).map(file))};
const ctx = {
  PropertiesService: {getScriptProperties: () => ({getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }})},
  CacheService: {getScriptCache: () => ({get: () => null, put: () => {}})},
  LockService: {getScriptLock: () => ({waitLock: () => {}, releaseLock: () => {}})},
  Utilities: {sleep: () => {}, formatDate: d => d.toISOString().slice(0, 10)},
  DriveApp: {getFolderById: () => folderObj, createFolder: () => folderObj},
  MimeType: {PLAIN_TEXT: 'text/plain'},
  ContentService: {MimeType: {JSON: 'json'}, createTextOutput: t => ({setMimeType: () => ({text: t})})},
  UrlFetchApp: {fetch: () => { throw new Error('no AI in sync test'); }}, console
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'REDEFINE Form Filler', 'server', 'Code.gs'), 'utf8'), ctx);

const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json'};
http.createServer((req, res) => {
  const cors = {'Access-Control-Allow-Origin': '*'};
  if (req.url === '/gas' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      const out = ctx.doPost({postData: {contents: body}});
      res.writeHead(200, Object.assign({'Content-Type': 'application/json'}, cors)); res.end(out.text);
    }); return;
  }
  if (req.url === '/__vault') { res.writeHead(200, {'Content-Type': 'application/json'}); return res.end(JSON.stringify(files)); }
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  if (rel === 'config.js') { res.writeHead(200, {'Content-Type': 'text/javascript'}); return res.end(`window.PSPT_CONFIG={api:location.origin+'/gas',maxPhotosPerRead:4};`); }
  const f = path.join(root, rel);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
  fs.createReadStream(f).pipe(res);
}).listen(5194, () => console.log('sync test on http://localhost:5194 and http://127.0.0.1:5194'));
