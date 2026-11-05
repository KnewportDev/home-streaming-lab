#!/usr/bin/env node
'use strict';
// Local visual development only. This server never sends a command to a TV.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const types = Object.freeze({
  'index.html': 'text/html; charset=utf-8',
  'home.css': 'text/css; charset=utf-8',
  'home.js': 'text/javascript; charset=utf-8',
  'config.json': 'application/json; charset=utf-8'
});
async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) {
    process.stdout.write('Local TV interface preview\n  node tools/preview-home.cjs [--port 8138]\nOnly listens on 127.0.0.1. It does not pair with or control the TV.\n');
    return;
  }
  if (argv.length && (argv.length !== 2 || argv[0] !== '--port')) throw Error('Use --port NUMBER or no options.');
  const port = argv.length ? Number(argv[1]) : 8138;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Choose a port from 1024 to 65535.');
  const home = path.resolve(__dirname, '../home'), files = {};
  if (await fs.realpath(home) !== home) throw Error('The home directory must not be a symbolic link.');
  for (const name of Object.keys(types)) {
    let filename = path.join(home, name), stat;
    try { stat = await fs.lstat(filename); }
    catch (error) {
      if (name !== 'config.json' || error.code !== 'ENOENT') throw error;
      filename = path.join(home, 'config.example.json'); stat = await fs.lstat(filename);
    }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576) throw Error('Preview assets must be ordinary files smaller than 1 MiB.');
    files[name] = await fs.readFile(filename);
  }
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    if (req.url === '/telemetry?event=ready') { res.writeHead(204); res.end(); return; }
    const name = req.url === '/' ? 'index.html' : req.url.slice(1);
    if (!Object.hasOwn(types, name)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': types[name]}); res.end(files[name]);
  });
  server.headersTimeout = 5000; server.requestTimeout = 5000; server.maxHeadersCount = 32;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
  process.stdout.write('Preview: http://127.0.0.1:' + port + '/\nRestart this command after editing assets. Ctrl+C stops the preview.\n');
  process.once('SIGINT', () => { server.close(); server.closeAllConnections(); });
  return server;
}
module.exports = { main };
if (require.main === module) main().catch(error => {
  const message = error.code === 'EADDRINUSE' ? 'Preview port is already in use. Choose --port with another port.' : error.message;
  process.stderr.write(message + '\n'); process.exitCode = 1;
});
