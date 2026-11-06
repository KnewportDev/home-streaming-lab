#!/usr/bin/env node
// SPDX-License-Identifier: MIT
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { generate } = require('./package-native-home.cjs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TOOL = path.join(__dirname, 'package-native-home.cjs');
const OUTPUTS = ['LICENSE', 'README.md', 'config.json', 'home.css', 'home.js', 'index.html', 'manifest.json'];
const EXAMPLE = {
  title: 'TV Guide',
  nativeBridge: { enabled: false },
  apps: [],
  appearance: { accent: 'sage' },
  testMode: true,
};

function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'native-home-package-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const source = path.join(temporary, 'source');
  fs.mkdirSync(path.join(source, 'home'), { recursive: true });
  for (const name of ['index.html', 'home.css', 'home.js']) {
    fs.copyFileSync(path.join(PROJECT_ROOT, 'home', name), path.join(source, 'home', name));
  }
  fs.copyFileSync(path.join(PROJECT_ROOT, 'LICENSE'), path.join(source, 'LICENSE'));
  fs.writeFileSync(path.join(source, 'home', 'config.example.json'), JSON.stringify(EXAMPLE));
  return { temporary, source, output: path.join(temporary, 'prepared package') };
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function manifestIn(directory) {
  return JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
}

test('package has exact allowlist, byte hashes and explicitly unverified target gates', t => {
  const f = fixture(t);
  generate(f.output, { sourceRoot: f.source });
  assert.deepEqual(fs.readdirSync(f.output).sort(), OUTPUTS);
  const manifest = manifestIn(f.output);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.package, 'vizio-native-interface-preparation');
  assert.deepEqual(manifest.target, {
    model: 'V405-H9', firmware: '1.720.9.1-1', viziOS: 'mtk5691-1.6.1770.1', eligibility: 'unverified',
  });
  assert.deepEqual(Object.keys(manifest.verification), [
    'rootAccess', 'nativeLocalOrigin', 'persistentStorage', 'internalInstallation',
    'onTvRendering', 'physicalRemote', 'nativeAppControl', 'homeOverride',
    'powerOnBoot', 'coldBoot', 'rollbackRecovery', 'bootloaderUnlock', 'replacementOS',
  ]);
  assert(Object.values(manifest.verification).every(value => value === 'unverified'));
  assert.deepEqual(manifest.defaults, { nativeBridgeEnabled: false, configuredApps: 0, testMode: true });
  assert.equal(manifest.hashAlgorithm, 'sha256');
  assert.deepEqual(manifest.files.map(file => file.path), OUTPUTS.filter(name => name !== 'manifest.json'));
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(path.join(f.output, file.path));
    assert.equal(file.bytes, bytes.length, file.path + ' byte size');
    assert.equal(file.sha256, hash(bytes), file.path + ' SHA-256');
  }
  assert.equal(manifest.version, 'sha256:' + hash(Buffer.from(JSON.stringify(manifest.files) + '\n')));
  for (const name of ['index.html', 'home.css', 'home.js']) {
    assert.deepEqual(fs.readFileSync(path.join(f.output, name)), fs.readFileSync(path.join(f.source, 'home', name)));
  }
  assert.deepEqual(fs.readFileSync(path.join(f.output, 'LICENSE')), fs.readFileSync(path.join(f.source, 'LICENSE')));
  const readme = fs.readFileSync(path.join(f.output, 'README.md'), 'utf8');
  assert.match(readme, /not an installer, firmware image, or replacement OS/);
  assert.match(readme, /proven TV-internal HTTP origin/);
  assert.match(readme, /rollback\/recovery/);
  assert.doesNotMatch(readme, /\/tmp\/scfs|mount -|flash_erase|fw_setenv/);
});

test('personal config, tokens, hidden state and extra assets are never read or included', t => {
  const f = fixture(t), secret = 'SYNTHETIC_PRIVATE_TOKEN_DO_NOT_PACKAGE';
  const privateConfig = path.join(f.source, 'home', 'config.json');
  fs.writeFileSync(privateConfig, '{ malformed personal config ' + secret);
  fs.mkdirSync(path.join(f.source, '.private'));
  fs.writeFileSync(path.join(f.source, '.private', 'session.json'), JSON.stringify({ auth: secret }));
  fs.writeFileSync(path.join(f.source, 'home', 'config.backup.json'), secret);
  fs.writeFileSync(path.join(f.source, 'home', 'unlisted.html'), secret);
  const originalOpen = fs.openSync;
  t.mock.method(fs, 'openSync', (filename, ...args) => {
    if (typeof filename === 'string' && (filename === privateConfig || filename.includes('.private'))) {
      assert.fail('Packager tried to open personal configuration or state.');
    }
    return originalOpen(filename, ...args);
  });
  generate(f.output, { sourceRoot: f.source });
  for (const filename of fs.readdirSync(f.output)) {
    assert(!fs.readFileSync(path.join(f.output, filename), 'utf8').includes(secret), filename);
  }
  const config = JSON.parse(fs.readFileSync(path.join(f.output, 'config.json'), 'utf8'));
  assert.deepEqual(config, {
    title: 'TV Guide', appearance: { accent: 'sage' }, testMode: true,
    nativeBridge: { enabled: false }, apps: [],
  });
  assert.deepEqual(fs.readdirSync(f.output).sort(), OUTPUTS);
});

test('identical input bytes produce identical packages independent of path and timestamps', t => {
  const f = fixture(t), second = path.join(f.temporary, 'another-output');
  generate(f.output, { sourceRoot: f.source });
  for (const name of ['index.html', 'home.css', 'home.js', 'config.example.json']) {
    fs.utimesSync(path.join(f.source, 'home', name), new Date(0), new Date(0));
  }
  generate(second, { sourceRoot: f.source });
  for (const name of OUTPUTS) {
    assert.deepEqual(fs.readFileSync(path.join(f.output, name)), fs.readFileSync(path.join(second, name)), name);
  }
  fs.appendFileSync(path.join(f.source, 'home', 'home.css'), '\n/* changed test input */\n');
  const changed = path.join(f.temporary, 'changed');
  generate(changed, { sourceRoot: f.source });
  assert.notEqual(manifestIn(changed).version, manifestIn(f.output).version);
  assert(!fs.readFileSync(path.join(changed, 'manifest.json'), 'utf8').includes(f.temporary));
});

test('unsafe or malformed shared configuration is rejected before output creation', t => {
  const f = fixture(t);
  const variants = [
    { ...EXAMPLE, nativeBridge: { enabled: true } },
    { ...EXAMPLE, nativeBridge: { enabled: false, auth: 'SYNTHETIC_SECRET' } },
    { ...EXAMPLE, apps: [{ label: 'Unverified', launch: { NAME_SPACE: 4, APP_ID: 'example', MESSAGE: null } }] },
    { ...EXAMPLE, auth: 'SYNTHETIC_SECRET' },
    { ...EXAMPLE, device: { address: '192.0.2.1' } },
    { ...EXAMPLE, testMode: false },
    { ...EXAMPLE, appearance: { accent: 'unrecognized' } },
    { ...EXAMPLE, title: 'x'.repeat(65) },
    null,
    [],
  ];
  for (const config of variants) {
    fs.writeFileSync(path.join(f.source, 'home', 'config.example.json'), JSON.stringify(config));
    assert.throws(() => generate(f.output, { sourceRoot: f.source }), /config\.example\.json/);
    assert(!fs.existsSync(f.output));
  }
  fs.writeFileSync(path.join(f.source, 'home', 'config.example.json'), '{"broken":');
  assert.throws(() => generate(f.output, { sourceRoot: f.source }), /valid UTF-8 JSON/);
  assert(!fs.existsSync(f.output));
});

test('nonempty directories and regular output files are preserved without overwrite', t => {
  const f = fixture(t);
  fs.mkdirSync(f.output);
  const sentinel = path.join(f.output, '.keep');
  fs.writeFileSync(sentinel, 'Keep the original bytes.');
  assert.throws(() => generate(f.output, { sourceRoot: f.source }), /must be empty/);
  assert.deepEqual(fs.readdirSync(f.output), ['.keep']);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'Keep the original bytes.');
  const ordinaryFile = path.join(f.temporary, 'ordinary-file');
  fs.writeFileSync(ordinaryFile, 'Do not replace.');
  assert.throws(() => generate(ordinaryFile, { sourceRoot: f.source }), /must be a directory/);
  assert.equal(fs.readFileSync(ordinaryFile, 'utf8'), 'Do not replace.');
  assert.throws(() => generate('', { sourceRoot: f.source }), /explicit output/);
  assert.throws(() => generate(path.join(f.temporary, 'missing-parent', 'out'), { sourceRoot: f.source }), /parent directory must already exist/);
  assert(!fs.existsSync(path.join(f.temporary, 'missing-parent')));
});

test('an existing empty directory is allowed and a completed package cannot be overwritten', t => {
  const f = fixture(t);
  fs.mkdirSync(f.output);
  generate(f.output, { sourceRoot: f.source });
  const original = fs.readFileSync(path.join(f.output, 'manifest.json'));
  assert.throws(() => generate(f.output, { sourceRoot: f.source }), /must be empty/);
  assert.deepEqual(fs.readFileSync(path.join(f.output, 'manifest.json')), original);
});

test('output symlinks/junctions and linked ancestor directories are refused', t => {
  const f = fixture(t), target = path.join(f.temporary, 'link-target');
  fs.mkdirSync(target);
  const link = path.join(f.temporary, 'linked-directory');
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => generate(link, { sourceRoot: f.source }), /symbolic-link or junction/);
  assert.throws(() => generate(path.join(link, 'nested-output'), { sourceRoot: f.source }), /symbolic-link or junction/);
  assert.deepEqual(fs.readdirSync(target), []);
});

test('linked source trees and a source file reported as a symlink are refused', t => {
  const f = fixture(t), link = path.join(f.temporary, 'linked-source');
  fs.symlinkSync(f.source, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => generate(f.output, { sourceRoot: link }), /symbolic-link or junction/);
  assert(!fs.existsSync(f.output));
  // A controlled lstat result covers file links on Windows without requiring
  // developer mode or administrator privileges for file symlink creation.
  const file = path.join(f.source, 'home', 'home.js'), originalLstat = fs.lstatSync;
  t.mock.method(fs, 'lstatSync', (filename, ...args) => {
    const stat = originalLstat(filename, ...args);
    if (filename === file) stat.isSymbolicLink = () => true;
    return stat;
  });
  assert.throws(() => generate(f.output, { sourceRoot: f.source }), /symbolic-link or junction/);
  assert(!fs.existsSync(f.output));
});

test('missing, oversized, empty, non-file and non-UTF-8 inputs fail before writing', t => {
  const f = fixture(t), css = path.join(f.source, 'home', 'home.css');
  const original = fs.readFileSync(css);
  fs.unlinkSync(css);
  assert.throws(() => generate(f.output, { sourceRoot: f.source }), /ENOENT/);
  fs.mkdirSync(css);
  assert.throws(() => generate(f.output, { sourceRoot: f.source }), /ordinary file/);
  fs.rmdirSync(css);
  fs.writeFileSync(css, Buffer.alloc(1048577, 65));
  assert.throws(() => generate(f.output, { sourceRoot: f.source }), /1048576 bytes/);
  fs.writeFileSync(css, '');
  assert.throws(() => generate(f.output, { sourceRoot: f.source }), /1 to 1048576 bytes/);
  fs.writeFileSync(css, Buffer.from([0xff, 0xfe, 0xff]));
  assert.throws(() => generate(f.output, { sourceRoot: f.source }), /encoded data|UTF-8/);
  fs.writeFileSync(css, original);
  fs.writeFileSync(path.join(f.source, 'home', 'config.example.json'), ' '.repeat(16385));
  assert.throws(() => generate(f.output, { sourceRoot: f.source }), /16384 bytes/);
  assert(!fs.existsSync(f.output));
});

test('packaging succeeds with network entry points forbidden', t => {
  const f = fixture(t);
  let attempts = 0;
  const forbidden = () => { attempts++; throw new Error('Network use is forbidden in packaging.'); };
  for (const name of ['node:http', 'node:https']) {
    const transport = require(name);
    t.mock.method(transport, 'request', forbidden);
    t.mock.method(transport, 'get', forbidden);
  }
  const net = require('node:net');
  t.mock.method(net, 'connect', forbidden);
  t.mock.method(net, 'createConnection', forbidden);
  t.mock.method(net.Socket.prototype, 'connect', forbidden);
  t.mock.method(require('node:dgram'), 'createSocket', forbidden);
  t.mock.method(require('node:dns'), 'lookup', forbidden);
  t.mock.method(globalThis, 'fetch', forbidden);
  generate(f.output, { sourceRoot: f.source });
  assert.equal(attempts, 0);
  assert.equal(manifestIn(f.output).target.eligibility, 'unverified');
});

test('CLI requires explicit output and resolves source beside the tool, not from cwd', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.source, 'tools'));
  const fixtureTool = path.join(f.source, 'tools', 'package-native-home.cjs');
  fs.copyFileSync(TOOL, fixtureTool);
  const run = args => spawnSync(process.execPath, [fixtureTool, ...args], {
    cwd: f.temporary, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(run(['--help']).status, 0);
  for (const args of [[], ['--out'], ['--out', f.output, '--unexpected'], ['--tv', '192.0.2.1']]) {
    const result = run(args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage:/);
  }
  const result = run(['--out', f.output]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Prepared 7 files/);
  assert.match(result.stdout, /No TV was contacted/);
  assert.deepEqual(fs.readdirSync(f.output).sort(), OUTPUTS);
  assert.notEqual(run(['--out', f.output]).status, 0);
});
