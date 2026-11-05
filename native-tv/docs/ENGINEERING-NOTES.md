# Engineering notes

These notes record observed behavior and the decisions it led to. The baseline below is from **5 November 2026**. Local network addresses, raw device responses, and pairing credentials are deliberately absent.

## Device observations

The TV's standard metadata endpoint reported V405-H9, firmware `1.720.9.1-1`, ViziOS `mtk5691-1.6.1770.1`, SmartCast API `3.9.1-2640.0002`, Conjure `128.1.9`, and Home `26.09.01.21`. Older notes said H19; the live API identity is the basis for current work.

| Observation | Engineering consequence |
| --- | --- |
| DIAL-only discovery found no TV. General SSDP returned a private responder advertising a bare HTTP location on port 9080. | Discovery now sends both searches and retains bounded private responder candidates. It verifies identity through fixed metadata endpoints instead of fetching an arbitrary advertised URL. |
| Standard SmartCast and Cast metadata requests responded. | Device identity and firmware can be checked before pairing or app actions. Numeric platform fields alone are not used as proof of a physical chip model. |
| Historical `/install` and `/scpl/` paths returned HTTP 404. | Those historical paths did not provide a working installation route in this session. This does not prove that every possible route is absent. |
| Checked SSH, telnet, ADB, debugging, and internal-server ports timed out from the LAN. | No access was established through those checks. A timeout does not establish whether a service exists internally. |
| A standard pairing start displayed a PIN on the TV. | The request caused a remote side effect, even though the client subsequently failed to save the returned challenge. |

The discovery behavior is covered by the `V405-H9 bare port9080 SSDP announcement` regression in [test-inspect-tv.cjs](../tools/test-inspect-tv.cjs). The implementation is [inspect-tv.cjs](../tools/inspect-tv.cjs).

## Windows pairing-state write failure

### Symptom

The television displayed a pairing PIN, but the CLI reported failure. Its private state remained at `starting`, without a challenge or authentication token. That made a network failure, rejected API request, malformed response, and failed local write initially plausible explanations.

The pairing challenge matters: the displayed PIN alone is insufficient for the documented pairing request. Repeating a start can also leave the TV reporting `BLOCKED`, which the upstream API documentation describes as pairing already in progress.

### Diagnosis

A redacted error stack located the failure at the existing-state `fs.open` call. An isolated probe on the actual Windows PC, using a disposable file and **Node.js v24.22.1**, produced:

| Operation | Observed result |
| --- | --- |
| `fs.open(file, O_WRONLY \| O_TRUNC)` | `EINVAL` |
| Numeric flags on that runtime: `1 \| 512` = `513` | Same failing call |
| `fs.open(file, 'r+')` | Succeeded |

This isolated local persistence from the TV request. It did not establish a general failure of numeric flags on every Windows or Node version. `O_NOFOLLOW` was absent on that runtime; blaming that constant would not explain the observed numeric `513` failure.

### Fix

[native-session.cjs](../tools/native-session.cjs) now serializes the state before opening the file. New state uses exclusive creation with `'wx'`. Updating existing state opens it with `'r+'`, then checks that the handle refers to the expected regular file before truncating through the handle. It writes the complete JSON, syncs, and closes the handle.

The existing path checks, symlink rejection, and file-identity comparison remain in place. POSIX mode `0600` is requested; Windows access control also depends on the private directory's ACL, so the mode alone is not treated as a complete Windows permissions policy. The update is an in-place write, not a power-loss-atomic transaction.

Recovery is state-aware. `pair-retry` is restricted to this client's untouched `starting` state, reuses its device ID, and makes one request. It refuses paired or awaiting-PIN states. If a successful start returns only part of a challenge, available fields are saved privately and another automatic start is refused.

### Validation

The Windows file probe established that `'r+'` opened the disposable file successfully on the affected machine. The offline regression then simulated `EINVAL` for numeric truncating opens and verified the replacement implementation:

- New and existing writes use `'wx'` and `'r+'`, respectively.
- Replacing a longer JSON value with a shorter one leaves no trailing bytes.
- The updated file can be read back as valid state.
- Separate tests preserve paired, awaiting-PIN, and incomplete-challenge states during recovery.

The test is named `Windows-compatible writes use exclusive creation and r+ before handle truncation` in [test-native-session.cjs](../tools/test-native-session.cjs). It uses synthetic state and a temporary directory. This validates the file-handling fix; it does not establish completed TV pairing or installation.

### Reproduce the offline checks

From `native-tv/`, with Node.js 24:

```sh
node --check home/home.js
node --test tools/test-inspect-tv.cjs tools/test-native-session.cjs tools/test-usb-diagnostic.cjs
node --test --test-name-pattern="Windows-compatible writes" tools/test-native-session.cjs
```

Recorded baseline: **30 tests passed, 0 failed** for the full suite. Tests use synthetic inputs, mocked TV transports, loopback servers, and temporary files. No TV credentials or home-network access are required.

To compare the underlying open behavior on a Windows runtime, this optional PowerShell probe creates and removes only its own temporary files:

```powershell
@'
const fs = require('node:fs/promises');
const { constants: C } = require('node:fs');
const os = require('node:os'), path = require('node:path');
(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vizio-open-probe-'));
  try {
    for (const [label, flags] of [['numeric', C.O_WRONLY | C.O_TRUNC], ['r+', 'r+']]) {
      const file = path.join(dir, label === 'numeric' ? 'numeric.json' : 'handle.json');
      await fs.writeFile(file, '{"fixture":true}\n', { flag: 'wx' });
      try {
        const handle = await fs.open(file, flags);
        await handle.close();
        console.log(label + ': success');
      } catch (error) { console.log(label + ': ' + error.code); }
    }
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
})().catch(() => { process.exitCode = 1; });
'@ | node
```

Other operating systems or runtime versions may produce different results. The cross-platform regression intentionally simulates the observed failure so it remains useful when CI runs on Linux.

## Recovering an old saved pairing challenge

The client can retain an `awaiting_pin` challenge after the on-screen PIN is no longer available. Reusing an earlier PIN failed on the target; the saved state still had no authentication credential. The original `pair-retry` command correctly refused to overwrite this pending challenge, but there was no explicit recovery command.

`pair-restart` uses the [documented cancellation request](https://github.com/exiva/Vizio_SmartCast_API#cancel-pairing) with the saved client identity and challenge. It verifies the exact model and firmware first, requires a successful cancellation, then persists a restart guard before sending one fresh start. A failed cancellation preserves the original bytes. An uncertain start or failed response save remains guarded against repeated starts.

Seven offline regressions cover the cancel/start ordering, failed cancellation, invalid states, device mismatch, lost start response, failed state save, and an incomplete fresh challenge. These checks use synthetic state and mocked responses. A fresh PIN still must come from the actual television; these tests do not complete pairing.

## Delivery evidence and next experiment

The workflow definition checks JavaScript syntax, runs the offline suite, and packages a six-file preview ZIP from an explicit allowlist. Local packaging verification confirmed the ZIP's entry list and that `config.json` comes from the shared example. A workflow definition or local test result is not evidence of a successful hosted run; use the matching GitHub Actions run when reporting CI status.

The earlier [hosted run for commit afabe7c](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42116511358) completed successfully with the then-current 23-test suite and uploaded its preview. The seven recovery regressions were added afterward; use the corresponding later run to verify that revision.

The next hardware experiment is to complete normal PIN pairing and request Conjure app 17 to load the local interface. Record API acceptance, a callback from the TV, visible layout, and remote behavior separately. Root access, replacement firmware, internal installation, and persistence remain unverified.

## References

- [Node.js 24 file-system flags](https://nodejs.org/docs/latest-v24.x/api/fs.html#file-system-flags) and [file-handle truncation](https://nodejs.org/docs/latest-v24.x/api/fs.html#filehandletruncatelen): documented API semantics; the specific `EINVAL` result above comes from the local Windows probe.
- [VIZIO Conjure launcher](https://vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html): pairing and authenticated app-launch request structure.
- [exiva SmartCast API](https://github.com/exiva/Vizio_SmartCast_API): pairing fields and result-code documentation.
