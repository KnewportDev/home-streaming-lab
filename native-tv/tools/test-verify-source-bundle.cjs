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
const { verifyArchive, assessDigests, makeReport, EXPECTED, MAX_BYTES } = require('./verify-source-bundle.cjs');

const TOOL = path.join(__dirname, 'verify-source-bundle.cjs');
const ABC_HASHES = {
  md5: '900150983cd24fb0d6963f7d28e17f72',
  sha1: 'a9993e364706816aba3e25717850c26c9cd0d89d',
  sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
};

function fixture(t, bytes = 'abc') {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'source-verifier-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const archive = path.join(directory, 'SYNTHETIC_PRIVATE_NAME.zip');
  const output = path.join(directory, 'SYNTHETIC_PRIVATE_REPORT.json');
  fs.writeFileSync(archive, bytes);
  return { directory, archive, output };
}

function run(args, cwd) {
  return spawnSync(process.execPath, [TOOL, ...args], { cwd, encoding: 'utf8', timeout: 10000 });
}

test('tiny known bytes produce correct hashes and only the public report schema', t => {
  const f = fixture(t), before = fs.statSync(f.archive, { bigint: true });
  const report = verifyArchive(f.archive);
  assert.deepEqual(Object.keys(report), [
    'expectedFilename', 'sourceUrl', 'sourcePinUrl', 'checksumsUrl', 'downloadPageUrl',
    'byteCount', 'hashes', 'publishedChecksumMatch', 'exactBuildCompatibility', 'installationEligibility',
  ]);
  assert.equal(report.expectedFilename, '5691_OSS_FUR7.2.zip');
  assert.equal(report.sourcePinUrl, report.sourceUrl + '/tree/1d05e3cb76d453a8d6a76f38dd2b8409b428bb11');
  assert.equal(report.checksumsUrl, report.sourceUrl + '/blob/1d05e3cb76d453a8d6a76f38dd2b8409b428bb11/checksums');
  assert.equal(report.byteCount, 3);
  assert.deepEqual(report.hashes, ABC_HASHES);
  assert.equal(report.publishedChecksumMatch, false);
  assert.equal(report.exactBuildCompatibility, 'unverified');
  assert.equal(report.installationEligibility, 'unverified');
  assert(!JSON.stringify(report).includes('SYNTHETIC_PRIVATE'));
  assert(!JSON.stringify(report).includes(f.directory));
  assert.equal(fs.readFileSync(f.archive, 'utf8'), 'abc');
  assert.equal(fs.statSync(f.archive, { bigint: true }).mtimeNs, before.mtimeNs);
  assert.deepEqual(fs.readdirSync(f.directory), [path.basename(f.archive)]);
});

test('multi-chunk hashing stays bounded and never reads the whole archive at once', t => {
  const bytes = Buffer.alloc(2 * 1024 ** 2 + 17, 0xa5), f = fixture(t, bytes);
  const originalRead = fs.readSync, requests = [];
  t.mock.method(fs, 'readSync', (fd, buffer, offset, length, position) => {
    requests.push(length);
    assert(buffer.length <= 1024 ** 2);
    return originalRead(fd, buffer, offset, length, position);
  });
  t.mock.method(fs, 'readFileSync', () => assert.fail('Whole-file reads are forbidden.'));
  const report = verifyArchive(f.archive);
  assert.equal(report.byteCount, bytes.length);
  assert(requests.length >= 4);
  assert(Math.max(...requests) <= 1024 ** 2);
  for (const name of ['md5', 'sha1', 'sha256']) {
    assert.equal(report.hashes[name], createHash(name).update(bytes).digest('hex'));
  }
});

test('both fixed published digests are required and even a match leaves eligibility unverified', () => {
  assert(Object.isFrozen(EXPECTED));
  assert.deepEqual(EXPECTED, {
    md5: '5b62eb08af859ee6cd49e654c45c76b1', sha1: '38c0a3e5cefd2eafa9acdad074ed88cea90c7b63',
  });
  assert.equal(assessDigests(EXPECTED), true);
  assert.equal(assessDigests({ ...EXPECTED, md5: ABC_HASHES.md5 }), false);
  assert.equal(assessDigests({ ...EXPECTED, sha1: ABC_HASHES.sha1 }), false);
  assert.equal(assessDigests({ md5: EXPECTED.md5 }), false);
  assert.equal(assessDigests(null), false);
  // This exercises report assessment with literal pins, not an acquired archive.
  const report = makeReport({ byteCount: 0, hashes: { ...EXPECTED, sha256: ABC_HASHES.sha256 }, privatePath: 'PRIVATE' });
  assert.equal(report.publishedChecksumMatch, true);
  assert.equal(report.exactBuildCompatibility, 'unverified');
  assert.equal(report.installationEligibility, 'unverified');
  assert(!JSON.stringify(report).includes('PRIVATE'));
});

test('CLI mismatch saves a rejected report exclusively, exits 2, and preserves input', t => {
  const f = fixture(t);
  const result = run(['--archive', f.archive, '--out', f.output], f.directory);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /^Rejected:/);
  assert.equal(JSON.parse(result.stdout).publishedChecksumMatch, false);
  assert.equal(fs.readFileSync(f.output, 'utf8'), result.stdout);
  assert(!result.stdout.includes(f.directory));
  assert(!result.stderr.includes('SYNTHETIC_PRIVATE'));
  assert.equal(fs.readFileSync(f.archive, 'utf8'), 'abc');
  if (process.platform !== 'win32') assert.equal(fs.statSync(f.output).mode & 0o777, 0o600);
});

test('empty input is a normal checksum rejection with correct empty-stream hashes', t => {
  const f = fixture(t, ''), report = verifyArchive(f.archive);
  assert.equal(report.byteCount, 0);
  assert.equal(report.publishedChecksumMatch, false);
  for (const name of ['md5', 'sha1', 'sha256']) assert.equal(report.hashes[name], createHash(name).digest('hex'));
});

test('oversized advertised files are refused before open or allocation', t => {
  const f = fixture(t), originalLstat = fs.lstatSync;
  assert.equal(MAX_BYTES, 32 * 1024 ** 3);
  // Keep the fixture tiny on Windows too; only the advertised metadata is huge.
  t.mock.method(fs, 'lstatSync', (filename, ...args) => {
    const stat = originalLstat(filename, ...args);
    if (filename === f.archive) stat.size = BigInt(MAX_BYTES) + 1n;
    return stat;
  });
  t.mock.method(fs, 'openSync', () => assert.fail('Oversized input must not be opened.'));
  assert.throws(() => verifyArchive(f.archive, f.output), /32 GiB/);
  assert(!fs.existsSync(f.output));
});

test('nonregular input, missing parents, relative paths, and traversal are refused', t => {
  const f = fixture(t);
  assert.throws(() => verifyArchive(f.directory), /ordinary file/);
  assert.throws(() => verifyArchive('relative.zip'), /absolute/);
  assert.throws(() => verifyArchive(f.archive, 'relative.json'), /absolute/);
  assert.throws(() => verifyArchive(f.directory + path.sep + '..' + path.sep + 'x.zip'), /traversal/);
  assert.throws(() => verifyArchive(f.archive, path.join(f.directory, 'missing', 'out.json')), /Filesystem/);
  assert.throws(() => verifyArchive('//network/share/archive.zip'), /Network/);
  if (process.platform === 'win32') assert.throws(() => verifyArchive('\\temp\\archive.zip'), /fully qualified/);
  assert(!fs.existsSync(path.join(f.directory, 'missing')));
});

test('existing output files, directories, and hardlinks are never overwritten', t => {
  const f = fixture(t);
  for (const bytes of ['', 'keep these bytes']) {
    fs.writeFileSync(f.output, bytes);
    assert.throws(() => verifyArchive(f.archive, f.output), /new file/);
    assert.equal(fs.readFileSync(f.output, 'utf8'), bytes);
  }
  fs.unlinkSync(f.output);
  fs.mkdirSync(f.output);
  assert.throws(() => verifyArchive(f.archive, f.output), /new file/);
  fs.rmdirSync(f.output);
  fs.linkSync(f.archive, f.output);
  assert.throws(() => verifyArchive(f.archive, f.output), /new file/);
  assert.throws(() => verifyArchive(f.archive, f.archive), /new file/);
  assert.equal(fs.readFileSync(f.output, 'utf8'), 'abc');
});

test('archive and output paths through directory symlinks or junctions are rejected', t => {
  const f = fixture(t), link = path.join(f.directory, 'linked');
  const real = path.join(f.directory, 'real');
  fs.mkdirSync(real);
  fs.writeFileSync(path.join(real, 'input.zip'), 'abc');
  fs.symlinkSync(real, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => verifyArchive(path.join(link, 'input.zip')), /symbolic-link or junction/);
  assert.throws(() => verifyArchive(f.archive, path.join(link, 'out.json')), /symbolic-link or junction/);
  assert.deepEqual(fs.readdirSync(real), ['input.zip']);
});

test('final input and output symlinks are refused without changing the target', t => {
  const f = fixture(t), link = path.join(f.directory, 'linked.zip');
  if (process.platform === 'win32') {
    // File symlinks otherwise require Windows developer mode or elevated rights.
    fs.writeFileSync(link, 'placeholder');
    const originalLstat = fs.lstatSync;
    t.mock.method(fs, 'lstatSync', (filename, ...args) => {
      const stat = originalLstat(filename, ...args);
      if (filename === link) stat.isSymbolicLink = () => true;
      return stat;
    });
  } else fs.symlinkSync(f.archive, link);
  assert.throws(() => verifyArchive(link), /symbolic-link or junction/);
  assert.throws(() => verifyArchive(f.archive, link), /symbolic-link or junction/);
  assert.equal(fs.readFileSync(f.archive, 'utf8'), 'abc');
});

function changeDuringRead(t, change) {
  const f = fixture(t, Buffer.alloc(1024 ** 2 + 5, 65));
  fs.utimesSync(f.archive, new Date(0), new Date(0));
  const originalRead = fs.readSync;
  let changed = false;
  t.mock.method(fs, 'readSync', (...args) => {
    const count = originalRead(...args);
    if (!changed && count) { changed = true; change(f); }
    return count;
  });
  assert.throws(() => verifyArchive(f.archive, f.output), /changed while being read/);
  assert.equal(changed, true);
  assert(!fs.existsSync(f.output));
}

test('mid-read growth is rejected without hashing an indefinitely growing stream', t => {
  changeDuringRead(t, f => fs.appendFileSync(f.archive, 'extra'));
});

test('mid-read truncation is rejected before a report is written', t => {
  changeDuringRead(t, f => fs.truncateSync(f.archive, 1));
});

test('same-length overwrite with restored mtime is rejected by change metadata', t => {
  changeDuringRead(t, f => {
    const fd = fs.openSync(f.archive, 'r+');
    try { fs.writeSync(fd, Buffer.from('B'), 0, 1, 0); } finally { fs.closeSync(fd); }
    fs.utimesSync(f.archive, new Date(0), new Date(0));
  });
});

test('replacing the input pathname after open is rejected', t => {
  changeDuringRead(t, f => {
    fs.renameSync(f.archive, f.archive + '.original');
    fs.writeFileSync(f.archive, Buffer.alloc(1024 ** 2 + 5, 65));
  });
});

test('a late output collision is refused by exclusive creation', t => {
  const f = fixture(t), originalOpen = fs.openSync;
  t.mock.method(fs, 'openSync', (filename, ...args) => {
    if (filename === f.output) {
      const fd = originalOpen(filename, 'wx');
      try { fs.writeFileSync(fd, 'late existing data'); } finally { fs.closeSync(fd); }
    }
    return originalOpen(filename, ...args);
  });
  assert.throws(() => verifyArchive(f.archive, f.output), /Filesystem/);
  assert.equal(fs.readFileSync(f.output, 'utf8'), 'late existing data');
});

test('verification and report writing use no network or subprocess entry points', t => {
  const f = fixture(t);
  let attempts = 0;
  const forbidden = () => { attempts++; throw new Error('External operation forbidden.'); };
  for (const name of ['node:http', 'node:https']) {
    t.mock.method(require(name), 'request', forbidden);
    t.mock.method(require(name), 'get', forbidden);
  }
  for (const name of ['connect', 'createConnection']) t.mock.method(require('node:net'), name, forbidden);
  t.mock.method(require('node:net').Socket.prototype, 'connect', forbidden);
  t.mock.method(require('node:dgram'), 'createSocket', forbidden);
  t.mock.method(require('node:dns'), 'lookup', forbidden);
  t.mock.method(globalThis, 'fetch', forbidden);
  for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
    t.mock.method(require('node:child_process'), name, forbidden);
  }
  assert.equal(verifyArchive(f.archive, f.output).publishedChecksumMatch, false);
  assert.equal(attempts, 0);
});

test('CLI forbids checksum overrides and sanitizes missing-file errors', t => {
  const f = fixture(t);
  assert.equal(run(['--help'], f.directory).status, 0);
  for (const args of [[], ['--archive'], ['--archive', f.archive, '--md5', ABC_HASHES.md5],
    ['--archive', f.archive, '--archive', f.archive], ['--archive', f.archive, '--out']]) {
    const result = run(args, f.directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
    assert.equal(result.stdout, '');
    assert(!result.stderr.includes('SYNTHETIC_PRIVATE'));
  }
  const result = run(['--archive', path.join(f.directory, 'PRIVATE_MISSING.zip')], f.directory);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert(!result.stderr.includes(f.directory));
  assert(!result.stderr.includes('PRIVATE_MISSING'));
});
