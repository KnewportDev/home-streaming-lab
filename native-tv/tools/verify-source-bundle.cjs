#!/usr/bin/env node
// SPDX-License-Identifier: MIT
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const MAX_BYTES = 32 * 1024 ** 3;
const BUFFER_BYTES = 1024 ** 2;
const PIN = '1d05e3cb76d453a8d6a76f38dd2b8409b428bb11';
const SOURCE = 'https://github.com/opensource-vizio/5691_FUR7.2_OpenSourceSoftware';
const EXPECTED = Object.freeze({
  md5: '5b62eb08af859ee6cd49e654c45c76b1',
  sha1: '38c0a3e5cefd2eafa9acdad074ed88cea90c7b63',
});
const USAGE = 'Usage: node tools/verify-source-bundle.cjs --archive ABS_ZIP [--out ABS_NEW_JSON]';
class VerificationError extends Error {}
function refuse(message) { throw new VerificationError(message); }

function absolutePath(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || /[\0\r\n]/.test(value)) {
    refuse('Archive and output paths must be absolute filesystem paths.');
  }
  // Check before normalization so a link followed by ".." cannot disappear.
  const parts = value.split(process.platform === 'win32' ? /[\\/]/ : /\//);
  if (parts.some(part => part === '.' || part === '..') || /^[\\/]{2}/.test(value) ||
      (process.platform === 'win32' && value.slice(2).includes(':'))) {
    refuse('Network, device, alternate-stream, and traversal paths are not accepted.');
  }
  if (process.platform === 'win32' && !/^[A-Za-z]:[\\/]/.test(value)) {
    refuse('Use a fully qualified drive path for archive and output.');
  }
  return path.normalize(value);
}

function inspectPath(filename, newOutput = false) {
  const root = path.parse(filename).root;
  const names = [root];
  for (const part of filename.slice(root.length).split(path.sep).filter(Boolean)) {
    names.push(path.join(names[names.length - 1], part));
  }
  return names.map((name, index) => {
    const last = index === names.length - 1;
    let stat;
    try { stat = fs.lstatSync(name, { bigint: true }); }
    catch (error) {
      if (error.code === 'ENOENT' && last && newOutput) return { name, stat: null };
      throw error;
    }
    if (stat.isSymbolicLink()) refuse('Refusing a symbolic-link or junction path.');
    if (!last && !stat.isDirectory()) refuse('Every parent must be an existing directory.');
    if (last && newOutput) refuse('Output must be a new file; nothing was overwritten.');
    if (last && !stat.isFile()) refuse('Archive must be an ordinary file.');
    return { name, stat };
  });
}

function sameFile(a, b) {
  return b.isFile() && ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].every(key => a[key] === b[key]);
}

function recheckParents(snapshot) {
  for (const { name, stat } of snapshot.slice(0, -1)) {
    const current = fs.lstatSync(name, { bigint: true });
    if (current.isSymbolicLink() || !current.isDirectory() ||
        current.dev !== stat.dev || current.ino !== stat.ino) {
      refuse('A parent directory changed during verification.');
    }
  }
}

function hashArchive(filename) {
  const snapshot = inspectPath(filename);
  const before = snapshot[snapshot.length - 1].stat;
  if (before.size > BigInt(MAX_BYTES)) refuse('Archive exceeds the 32 GiB limit.');
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0);
  const fd = fs.openSync(filename, flags);
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    if (!sameFile(before, opened)) refuse('Archive changed while being opened.');
    recheckParents(snapshot);
    const hashes = Object.fromEntries(['md5', 'sha1', 'sha256'].map(name => [name, createHash(name)]));
    const buffer = Buffer.alloc(BUFFER_BYTES);
    const initialBytes = Number(opened.size);
    let byteCount = 0;
    while (true) {
      // At most one byte beyond the opening size is read to detect growth.
      const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, initialBytes - byteCount + 1), null);
      if (!count) break;
      byteCount += count;
      if (byteCount > initialBytes || byteCount > MAX_BYTES) refuse('Archive changed while being read.');
      for (const hash of Object.values(hashes)) hash.update(buffer.subarray(0, count));
    }
    const after = fs.fstatSync(fd, { bigint: true });
    const named = fs.lstatSync(filename, { bigint: true });
    recheckParents(snapshot);
    if (named.isSymbolicLink() || byteCount !== initialBytes ||
        !sameFile(opened, after) || !sameFile(opened, named)) {
      refuse('Archive changed while being read.');
    }
    return { byteCount, hashes: Object.fromEntries(Object.entries(hashes).map(([name, hash]) => [name, hash.digest('hex')])) };
  } finally { fs.closeSync(fd); }
}

function assessDigests(hashes) {
  return hashes?.md5 === EXPECTED.md5 && hashes?.sha1 === EXPECTED.sha1;
}

function makeReport(result) {
  return {
    expectedFilename: '5691_OSS_FUR7.2.zip',
    sourceUrl: SOURCE,
    sourcePinUrl: SOURCE + '/tree/' + PIN,
    checksumsUrl: SOURCE + '/blob/' + PIN + '/checksums',
    downloadPageUrl: 'https://d2mi77xcznxniv.cloudfront.net/index.html?file=5691_OSS_FUR7.2.zip',
    byteCount: result.byteCount,
    hashes: { md5: result.hashes.md5, sha1: result.hashes.sha1, sha256: result.hashes.sha256 },
    publishedChecksumMatch: assessDigests(result.hashes),
    exactBuildCompatibility: 'unverified',
    installationEligibility: 'unverified',
  };
}

function writeReport(filename, snapshot, report) {
  recheckParents(snapshot);
  inspectPath(filename, true);
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0);
  const fd = fs.openSync(filename, flags, 0o600);
  try {
    recheckParents(snapshot);
    const opened = fs.fstatSync(fd, { bigint: true });
    const named = fs.lstatSync(filename, { bigint: true });
    if (named.isSymbolicLink() || !sameFile(opened, named)) refuse('Output changed while being created.');
    fs.writeFileSync(fd, JSON.stringify(report, null, 2) + '\n', 'utf8');
    fs.fsyncSync(fd);
    recheckParents(snapshot);
    const after = fs.lstatSync(filename, { bigint: true });
    if (after.isSymbolicLink() || !sameFile(fs.fstatSync(fd, { bigint: true }), after)) {
      refuse('Output changed while being written.');
    }
  } finally { fs.closeSync(fd); }
}

function verifyArchive(archive, output) {
  try {
    const input = absolutePath(archive);
    const destination = output === undefined ? undefined : absolutePath(output);
    const outputSnapshot = destination === undefined ? null : inspectPath(destination, true);
    const report = makeReport(hashArchive(input));
    if (destination !== undefined) writeReport(destination, outputSnapshot, report);
    return report;
  } catch (error) {
    // Native fs errors include local paths; none may escape into a shared report.
    if (error instanceof VerificationError) throw error;
    refuse('Filesystem operation failed; check that the input and output are accessible and stable.');
  }
}

function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(USAGE);
    return 0;
  }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index], value = args[index + 1];
    if (!['--archive', '--out'].includes(option) || option in options || !value || value.startsWith('--')) refuse(USAGE);
    options[option] = value;
  }
  if (!options['--archive']) refuse(USAGE);
  const report = verifyArchive(options['--archive'], options['--out']);
  console.log(JSON.stringify(report, null, 2));
  if (!report.publishedChecksumMatch) {
    console.error('Rejected: archive checksums do not match the pinned publisher record. Compatibility and installation remain unverified.');
    return 2;
  }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof VerificationError ? error.message : 'Source bundle verification failed.');
    process.exitCode = 1;
  }
}

module.exports = { verifyArchive, assessDigests, makeReport, EXPECTED, MAX_BYTES };
