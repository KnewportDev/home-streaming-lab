#!/usr/bin/env node
// SPDX-License-Identifier: MIT
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { TextDecoder } = require('node:util');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TARGET = Object.freeze({
  model: 'V405-H9',
  firmware: '1.720.9.1-1',
  viziOS: 'mtk5691-1.6.1770.1',
  eligibility: 'unverified',
});
const ASSETS = Object.freeze([
  { input: 'home/index.html', output: 'index.html', limit: 1048576 },
  { input: 'home/home.css', output: 'home.css', limit: 1048576 },
  { input: 'home/home.js', output: 'home.js', limit: 1048576 },
  { input: 'home/tv-check.html', output: 'tv-check.html', limit: 1048576 },
  { input: 'LICENSE', output: 'LICENSE', limit: 65536 },
]);
const GATES = Object.freeze([
  'rootAccess', 'nativeLocalOrigin', 'persistentStorage', 'internalInstallation',
  'onTvRendering', 'physicalRemote', 'nativeAppControl', 'homeOverride',
  'powerOnBoot', 'coldBoot', 'rollbackRecovery', 'bootloaderUnlock', 'replacementOS',
]);
const USAGE = 'Usage: node tools/package-native-home.cjs --out <new-or-empty-directory>';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function noSymlinkAncestors(filename) {
  const root = path.parse(filename).root;
  let current = root;
  for (const segment of filename.slice(root.length).split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error('Refusing a symbolic-link or junction path.');
  }
}

function readAsset(root, relative, limit) {
  const filename = path.join(root, relative);
  noSymlinkAncestors(filename);
  const before = fs.lstatSync(filename);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error(relative + ' must be an ordinary file.');
  }
  if (before.size < 1 || before.size > limit) {
    throw new Error(relative + ' must contain 1 to ' + limit + ' bytes.');
  }
  const fd = fs.openSync(filename, 'r');
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error(relative + ' changed while being opened.');
    }
    // Read at most limit + 1 bytes, even if another process grows the file.
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    const after = fs.fstatSync(fd);
    if (length < 1 || length > limit) throw new Error(relative + ' exceeds its permitted size.');
    if (length !== opened.size || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs) {
      throw new Error(relative + ' changed while being read.');
    }
    const bytes = buffer.subarray(0, length);
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return bytes;
  } finally {
    fs.closeSync(fd);
  }
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function onlyKeys(value, allowed) {
  return Object.keys(value).every(key => allowed.includes(key));
}

function sharedConfig(bytes) {
  let config;
  try { config = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (error) { throw new Error('config.example.json must be valid UTF-8 JSON.'); }
  if (!object(config) || !onlyKeys(config, ['title', 'appearance', 'testMode', 'nativeBridge', 'apps'])) {
    throw new Error('config.example.json contains unsupported fields; personal data is not permitted.');
  }
  if (typeof config.title !== 'string' || !config.title.trim() || config.title.length > 64 ||
      /[\u0000-\u001f\u007f]/.test(config.title)) {
    throw new Error('config.example.json needs a public title of 1 to 64 characters.');
  }
  if (!object(config.nativeBridge) || !onlyKeys(config.nativeBridge, ['enabled']) ||
      config.nativeBridge.enabled !== false) {
    throw new Error('config.example.json must explicitly disable nativeBridge.');
  }
  if (!Array.isArray(config.apps) || config.apps.length !== 0) {
    throw new Error('config.example.json must have an empty app catalog.');
  }
  if (config.testMode !== true) throw new Error('config.example.json must keep testMode enabled.');
  let accent = 'sage';
  if (config.appearance !== undefined) {
    if (!object(config.appearance) || !onlyKeys(config.appearance, ['accent']) ||
        !['sage', 'glacier', 'amber'].includes(config.appearance.accent)) {
      throw new Error('config.example.json has an unsupported appearance.');
    }
    accent = config.appearance.accent;
  }
  // Reconstruct the runtime config from this strict public schema.
  // Never read home/config.json or copy unknown fields.
  return Buffer.from(JSON.stringify({
    title: config.title.trim(),
    appearance: { accent },
    testMode: true,
    nativeBridge: { enabled: false },
    apps: [],
  }, null, 2) + '\n');
}

function packageReadme() {
  return Buffer.from([
    '# Native TV interface — preparation package',
    '',
    '**This package is not an installer, firmware image, or replacement OS.**',
    'It contains the current open-source browser interface and a public example',
    'configuration. It does not establish that the interface is installed on a TV.',
    '',
    '## Target and verification',
    '',
    'Observed target: VIZIO ' + TARGET.model + ', system firmware ' + TARGET.firmware + ',',
    'ViziOS build ' + TARGET.viziOS + '. Installation eligibility remains unverified.',
    'These identity values are a compatibility boundary, not evidence that this',
    'model or another firmware supports a particular root or installation route.',
    '',
    'Every native verification gate in manifest.json remains unverified: root,',
    'TV-local origin, persistent storage, internal installation, TV rendering,',
    'physical remote input, app control, Home override, normal boot, cold boot,',
    'rollback/recovery, bootloader unlock, and replacement OS.',
    '',
    'Before any native deployment, establish the actual TV-local origin and',
    'storage behavior, an independently verified installation route, and recovery',
    'on the exact target. Preserve and verify that TV\'s original files. This',
    'package supplies no installation path, mount command, boot hook, flash image,',
    'root payload, or recovery procedure. A Home override and kernel/firmware',
    'replacement are separate milestones.',
    '',
    '## Contents',
    '',
    '- index.html, home.css, home.js: current interface source, copied as bytes.',
    '- tv-check.html: standalone screen and remote check; connection check is opt-in.',
    '- config.json: generated only from the shared config.example.json.',
    '- LICENSE: the original project MIT license.',
    '- README.md: this preparation status and package description.',
    '- manifest.json: target, unverified gates, file sizes and SHA-256 hashes.',
    '',
    'The guide and its configuration use relative requests and must',
    'remain together if eventually served from a proven TV-internal HTTP origin.',
    'No internal HTTP service or deployment is created by this package.',
    'The native adapter remains disabled. The app catalog is empty; the guide',
    'contains explicitly labeled fictional listings, with no connected channels,',
    'playback source or live electronic program feed.',
    '',
    'Personal home/config.json, pairing state, .private files, local addresses,',
    'credentials and arbitrary extra files are excluded by the input allowlist.',
    'The generator makes no network requests and runs no TV commands or server.',
    'It writes only to the selected new or empty local output directory.',
    'The public preview and its deployment are unaffected.',
    '',
    '## Reproducibility and integrity',
    '',
    'manifest.json uses schemaVersion 1. Its sorted files array lists the byte',
    'length and SHA-256 of every included file except the manifest itself.',
    'The version is sha256: followed by SHA-256 of the UTF-8 encoding of',
    'JSON.stringify(manifest.files) plus a single LF newline. This content-derived',
    'version identifies package bytes; it does not claim installed compatibility.',
    'No timestamp, absolute build path, machine identity or private state is added.',
    'Hashes establish byte identity, not authorship or a cryptographic signature.',
    '',
    'The generator accepts ordinary UTF-8 source files: each HTML/CSS/JS asset',
    'is limited to 1 MiB, the shared example to 16 KiB, and LICENSE to 64 KiB.',
    'It refuses symlink/junction paths and nonempty output directories.',
    'On an I/O failure, a partial output may remain without a completed manifest;',
    'no existing files are overwritten or automatically removed.',
    '',
    '## Primary references',
    '',
    '- Vizio Open Home: https://github.com/jordanmateo-byte/vizio-open-home',
    '  Reports a Home override on M657-G0 / SX7B / 7.0.120.1-1; this does not',
    '  establish compatibility with the target named above.',
    '- Original USB research:',
    '  https://www.eltoncyber.com/advisories/vizio-tv-code-execution-from-a-usb-drive',
    '  Its demonstrated models differ from the target.',
    '',
    'Original interface and packaging code are MIT licensed; retain LICENSE.',
    '',
  ].join('\n'));
}

function outputDirectory(output) {
  if (typeof output !== 'string' || !output.trim()) {
    throw new Error('An explicit output directory is required.');
  }
  const directory = path.resolve(output);
  noSymlinkAncestors(directory);
  let stat;
  try { stat = fs.lstatSync(directory); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (stat) {
    if (!stat.isDirectory()) throw new Error('Output must be a directory.');
    if (fs.readdirSync(directory).length) throw new Error('Output directory must be empty; nothing was overwritten.');
  } else {
    const parent = path.dirname(directory);
    let parentStat;
    try { parentStat = fs.lstatSync(parent); }
    catch (error) {
      if (error.code === 'ENOENT') throw new Error('Output parent directory must already exist.');
      throw error;
    }
    if (!parentStat.isDirectory()) throw new Error('Output parent must be a directory.');
    fs.mkdirSync(directory, { mode: 0o700 });
  }
  return { directory, stat: fs.lstatSync(directory) };
}

function generate(output, options = {}) {
  if (typeof output !== 'string' || !output.trim()) {
    throw new Error('An explicit output directory is required.');
  }
  const source = path.resolve(options.sourceRoot || PROJECT_ROOT);
  noSymlinkAncestors(source);
  if (!fs.lstatSync(source).isDirectory()) throw new Error('Source root must be a directory.');
  const payload = new Map();
  for (const asset of ASSETS) {
    payload.set(asset.output, readAsset(source, asset.input, asset.limit));
  }
  payload.set('config.json', sharedConfig(readAsset(source, 'home/config.example.json', 16384)));
  payload.set('README.md', packageReadme());
  const files = Array.from(payload.keys()).sort().map(name => ({
    path: name,
    bytes: payload.get(name).length,
    sha256: sha256(payload.get(name)),
  }));
  const manifest = {
    schemaVersion: 1,
    package: 'vizio-native-interface-preparation',
    version: 'sha256:' + sha256(Buffer.from(JSON.stringify(files) + '\n')),
    target: { ...TARGET },
    verification: Object.fromEntries(GATES.map(gate => [gate, 'unverified'])),
    defaults: { nativeBridgeEnabled: false, configuredApps: 0, testMode: true },
    hashAlgorithm: 'sha256',
    files,
  };
  // Validate every input before creating an output directory.
  const destination = outputDirectory(output);
  const write = (name, bytes) => {
    noSymlinkAncestors(destination.directory);
    const current = fs.lstatSync(destination.directory);
    if (!current.isDirectory() || current.dev !== destination.stat.dev || current.ino !== destination.stat.ino) {
      throw new Error('Output directory changed during packaging; preparation is incomplete.');
    }
    fs.writeFileSync(path.join(destination.directory, name), bytes, { flag: 'wx', mode: 0o644 });
  };
  for (const file of files) write(file.path, payload.get(file.path));
  // Written last: an interrupted build must not claim a complete manifest.
  write('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  return { directory: destination.directory, manifest };
}

function main(args = process.argv.slice(2)) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log(USAGE);
    console.log('Offline preparation only. No installer, TV connection, or native verification.');
    return;
  }
  if (args.length !== 2 || args[0] !== '--out' || !args[1] || args[1].startsWith('--')) {
    throw new Error(USAGE);
  }
  const result = generate(args[1]);
  console.log('Prepared 8 files in ' + result.directory);
  console.log('Package version: ' + result.manifest.version);
  console.log('Native installation, boot and recovery remain unverified. No TV was contacted.');
}

module.exports = { generate, main };
if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
