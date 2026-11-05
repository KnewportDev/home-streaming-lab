# Vizio Native

A personal IT and networking homelab for building a custom interface in a VIZIO television's own browser. The goal is a usable, locally controlled home screen with the look of early Windows Media Center and Aero.

The engineering problem is compatibility: finding what this particular TV exposes, integrating its control API, and proving each step on the actual firmware. The project includes a remote-friendly interface, bounded network discovery, a PIN-pairing client, and an offline test and preview pipeline.

Canonical source: [KnewportDev/home-streaming-lab](https://github.com/KnewportDev/home-streaming-lab), under `native-tv/`. Original project code is [MIT licensed](LICENSE).

**Current status:** the interface and tools are built, the TV's metadata has been read, and the offline suite passes **23 tests**. PIN pairing is pending completion. Authenticated launch, JavaScript execution on the TV, internal installation, root access, and a persistent Home replacement remain unverified.

## What this project demonstrates

| Area | Implementation and evidence |
| --- | --- |
| Network discovery | Bounded SSDP discovery, private IPv4 validation, and fixed GET-only metadata requests. A regression covers this TV's bare port-9080 announcement. |
| API integration | Model and firmware checks, ordinary VIZIO PIN pairing, explicit pairing states, and the documented Conjure app 17 launch request. |
| Windows troubleshooting | Isolated a state-write failure after the TV displayed a PIN; replaced the failing numeric open flags with a checked file handle and added a regression. |
| Local data handling | Pairing state stays in an explicit private file; reports and status messages omit credentials and device identifiers. |
| Testing and CI | 23 passing offline tests at the current baseline; a scoped GitHub Actions workflow checks source and packages only the preview's allowlisted files. |
| Interface development | Local HTML, CSS, and JavaScript with directional navigation, visible focus, and no external fonts or analytics. |

Read the [engineering notes](docs/ENGINEERING-NOTES.md) for the debugging evidence and [portfolio summary](docs/PORTFOLIO.md) for a short project explanation.

## Current device evidence

The television responded directly on the home network on 5 November 2026:

| Field | Live response |
| --- | --- |
| Reported model | V405-H9 |
| System firmware | 1.720.9.1-1 |
| ViziOS build | mtk5691-1.6.1770.1 |
| SmartCast API | 3.9.1-2640.0002 |
| Conjure | 128.1.9 |
| Home component | 26.09.01.21 |

Older notes called the set V405-H19. The live API identity is used for this build; this does not establish whether the physical retail label uses a different suffix.

The standard device-information API responds. The historical `/install` and `/scpl/` paths returned HTTP 404. Connections to the checked SSH, telnet, ADB, developer-debugging and internal-webserver ports timed out from the LAN. A network timeout does not establish whether a service exists internally.

**Root access, a bootloader unlock, replacement firmware, internal installation and a permanent Home replacement have not been established.** The custom browser interface is a separate, testable step toward the requested native-TV setup. It does not replace the TV's Linux kernel or proprietary firmware.

## Contents

- `home/`: original, local interface source with remote-control navigation. No external fonts, ads or analytics.
- `tools/inspect-tv.cjs`: bounded, GET-only metadata discovery. Reports omit serial numbers, credentials and raw device responses.
- `tools/make-usb-diagnostic.cjs`: prepares a fixed read-only capability script in a new/empty directory. It does not contact a TV or infer that this model can execute the script.
- `tools/native-session.cjs`: standard PIN pairing and a temporary native browser test using VIZIO's documented Conjure app-launch route. Credentials stay in an explicitly selected local state file and must not be published.
- `tools/preview-home.cjs`: a local interface preview on the development computer.

## Start with the local preview

Use **Node.js 24**. No package installation is required. Run commands from `native-tv/`:

```sh
node tools/preview-home.cjs
```

Open [http://127.0.0.1:8138](http://127.0.0.1:8138). Use arrow keys, Enter, and Back/Escape to explore the interface. The preview binds to the local computer.

The preview automatically uses `home/config.example.json` when personal `home/config.json` is absent, so a fresh clone runs without configuration setup. Keep personal configuration in `home/config.json`, which is ignored by Git. See [the interface documentation](home/README.md) for configuration and native adapter details. Only add application launch values verified on the target television.

## Architecture

| Component | Runs on | Role |
| --- | --- | --- |
| `home/` | Computer or TV browser | Local HTML, CSS, JavaScript, remote navigation, and configuration. |
| `preview-home.cjs` | Development PC | Local interface preview. |
| `inspect-tv.cjs` | A PC on the TV's LAN | Bounded discovery and GET-only metadata inspection. |
| `native-session.cjs` | A PC on the TV's LAN | PIN pairing, a temporary asset server, and Conjure app 17 launch. |
| `make-usb-diagnostic.cjs` | Development PC | Prepares a fixed diagnostic CGI; it does not execute it on a TV. |

For a native browser test, the session tool serves four allowlisted assets from the PC under a random path. After pairing, it asks Conjure to open that URL. The TV executes the page and sends a small readiness callback. The PC must keep serving the files during this test.

`launch_accepted` means the control request was accepted. `tv_javascript_ready` means the TV returned the page's JavaScript callback. Screen appearance, remote navigation, application launching, and persistence need their own observations. The internal native API adapter has a separate origin guard and is not enabled by a PC-hosted preview.

## Inspect

Node.js 24 is the development baseline; the inspection tool also supports Node.js 18 or newer:

```sh
node tools/inspect-tv.cjs
node tools/inspect-tv.cjs --ip 192.168.1.50
```

Replace the example address with the TV's private LAN address. Discovery includes the announcement format actually seen from this TV. An empty discovery result is not a compatibility verdict; the explicit private IP can still work. Store any saved reports under `.private/`.

## Native browser test

Use Node.js 24 for the session tool. PIN pairing is the ordinary VIZIO control pairing flow. The session tool checks the V405-H9/H19 family and exact firmware `1.720.9.1-1` before each action, and detects a model or firmware change after pairing begins.

The following examples use PowerShell. Replace `192.168.1.50` with the TV's address and `192.168.1.20` with the PC's LAN address. Both devices must be reachable on the same LAN.

```powershell
New-Item -ItemType Directory -Force .private | Out-Null
$tvState = Join-Path (Resolve-Path .private).Path "tv-session.json"
node tools/native-session.cjs --help
node tools/native-session.cjs pair-start --tv 192.168.1.50 --state "$tvState"
```

The first start creates a new state file exclusively. Use the PIN currently displayed on the television in place of `TV_PIN`:

```powershell
node tools/native-session.cjs pair-code --state "$tvState" --pin TV_PIN
node tools/native-session.cjs serve-launch --state "$tvState" --bind 192.168.1.20 --port 8137 --home ./home
```

The native session requires `home/index.html`, `home/home.css`, `home/home.js`, and a local `home/config.json`. The PC must remain available during this test. If a firewall rule is needed, restrict it to the TV's IP and this server port. Ctrl+C stops the PC server; it does not issue a TV power or app command. On other operating systems, the same CLI works with an absolute state path in a private directory.

An accepted launch request alone is not a successful test. Verify that the television requests the page and sends the expected readiness callback, and confirm the screen and remote controls with the owner. Native app-control integration and permanent installation remain separate checks.

Do not publish the pairing state file, authentication token, local addresses or raw television configuration. The source archive deliberately excludes those values.

### Recover a failed start

```powershell
node tools/native-session.cjs pair-retry --state "$tvState"
```

Retry is available only for an existing `starting` state without a token or challenge. It reuses the same device identity and performs one start attempt. Paired or awaiting-PIN states are preserved and refused. A successful new start may display a new PIN.

`BLOCKED` means a pairing operation is already in progress. Retrying does not clear that TV-side condition. An incomplete successful response preserves any available challenge fields privately and stops further retries. Never fabricate a challenge token or submit guessed PINs. Windows state updates use a verified existing file handle, following the fix for the observed `EINVAL` failure.

## Optional USB diagnostic preparation

```sh
node tools/make-usb-diagnostic.cjs --out ./new-usb-diagnostic
```

This creates only a fixed diagnostic CGI and instructions. Read the generated instructions. Copying files to USB does not demonstrate code execution. The actual USB mount and a valid native execution route must be observed before any invocation. No flashing, boot changes, network shell or persistence mechanism is included.

## Develop and verify

```sh
node --check home/home.js
node --test tools/test-inspect-tv.cjs tools/test-native-session.cjs tools/test-usb-diagnostic.cjs
```

The recorded baseline on 5 November 2026 is **23 tests passed, 0 failed**. Tests use synthetic metadata, mocked TV transports, loopback servers, and temporary files; they do not contact the TV. They cover private address restrictions, metadata redaction, model/firmware checks, pairing recovery, Windows-compatible state writes, local serving restrictions, and diagnostic generation.

The repository-root workflow, `.github/workflows/native-tv.yml`, defines these checks for changes to `native-tv/`. It uses Node.js 24 and commit-pinned GitHub actions. After successful checks, it packages a browser preview ZIP and uploads it to that workflow run. It has no TV credentials, device access, or deployment step. A passing build validates code; it does not prove TV installation.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) for development conventions.

## Ongoing development pipeline

1. **Branch:** make a focused change under `native-tv/` and open a pull request.
2. **Checks:** GitHub Actions checks the interface's JavaScript syntax and runs the offline regression suite.
3. **Preview artifact:** a successful run provides `native-tv-preview-COMMIT_SHA.zip` in its artifacts. It contains only `index.html`, `home.css`, `home.js`, a `config.json` made from the shared example, the interface README, and the MIT license. Personal configuration and state are excluded. Artifacts are retained for 14 days.
4. **TV verification:** use the matching source revision for a temporary native browser session and record the exact model, firmware, page callback, screen behavior, and remote controls actually observed.
5. **Future release:** promote a revision only with clear release notes describing the tested behavior and remaining limits. A firmware installer or persistent TV deployment is a future milestone, not part of the current workflow.

For local development, the Node preview command above is the quickest route. The downloaded artifact is a flat static bundle that can also be served by a local HTTP server; opening its HTML directly as a file may prevent its configuration request from working.

## Next milestones

- Complete ordinary PIN pairing and capture the first verified TV JavaScript callback.
- Validate screen layout, remote keys, and return-to-Home behavior on the exact target firmware.
- Populate a small catalog using application identifiers observed on that TV.
- Investigate a reversible internal hosting or installation route, with backups and observed restart behavior before calling it persistent.

## Primary references

- VIZIO's own [SmartCast app launcher](https://vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html).
- true[X]'s [retail SmartCast deployment guide](https://github.com/socialvibe/truex-ctv-web-reference-app/blob/develop/platforms/Vizio/README.md).
- [SmartCast API documentation](https://github.com/exiva/Vizio_SmartCast_API).
- [Vizio Open Home](https://github.com/jordanmateo-byte/vizio-open-home): a native Home modification reported on M657-G0, SX7B, firmware 7.0.120.1-1. Its hardware validation does not establish compatibility with this TV.
- [ELTON's USB CGI research](https://www.eltoncyber.com/advisories/vizio-tv-code-execution-from-a-usb-drive): demonstrated on other VIZIO models.
- [ViziOwn research](https://bh2017.exploitee.rs/2021/viziown-exploiting-vizio-smartcast/): historical root route; the named installation endpoint is not present at its old path on this device.

## License

Original project code is provided under the MIT license in `LICENSE`. Protocol documentation is cited as evidence; no third-party firmware, signing keys or proprietary binaries are bundled.

