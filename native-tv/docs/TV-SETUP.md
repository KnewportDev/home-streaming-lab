# TV setup and development checks

Run these commands from `native-tv/` with **Node.js 24**. The tools have no package-install step. Examples use PowerShell for TV sessions and placeholder private LAN addresses.

The observed target is **V405-H9**, firmware **1.720.9.1-1**, ViziOS **mtk5691-1.6.1770.1**. The session client checks the H9/H19 family and exact firmware before actions, and detects changes after pairing begins. The live identity is the basis for compatibility work.

## 1. Preview on the development computer

```sh
node tools/preview-home.cjs
```

Open [http://127.0.0.1:8138](http://127.0.0.1:8138). The server binds to the local computer and serves the interface assets. Arrows navigate, Enter opens sample-program information, and Back/Escape closes a dialog or opens Settings. Restart the preview process after editing files.

When `home/config.json` is absent, this preview uses `home/config.example.json`. Keep personal configuration in the ignored `home/config.json`. Only add application launch values observed on the target TV. See [interface configuration](../home/README.md).

The downloadable preview artifact is a flat static bundle. Serve it through a local HTTP server; opening `index.html` directly as a file can prevent its configuration request from working.

## 2. Inspect the TV

```sh
node tools/inspect-tv.cjs
node tools/inspect-tv.cjs --ip 192.168.1.50
```

Replace `192.168.1.50` with the TV's actual private LAN address. Discovery includes the bare port-9080 announcement observed from this set. An empty discovery result does not establish compatibility or incompatibility; inspection by an explicit private IP may still work.

The inspector makes bounded, fixed GET requests and redacts credentials and device identifiers. Save any local reports under `.private/`. It supports Node.js 18 or newer, although Node.js 24 is the project baseline.

## 3. Reuse a paired session

If pairing has already completed, use that existing private state file. Do not run `pair-start` again. For a state file at `.private/tv-session.json`:

```powershell
$tvState = (Resolve-Path .private/tv-session.json).Path
node tools/native-session.cjs --help
node tools/inspect-native-platform.cjs --state "$tvState"
```

Use the existing file's absolute path if it is stored elsewhere. The platform inspector reads a fixed set of informational endpoints from the paired target and produces a redacted report. It neither pairs again nor interprets API access as root.

### First pairing only

For a TV that has not been paired with this client, replace the address below with its actual private LAN address:

```powershell
New-Item -ItemType Directory -Force .private | Out-Null
$tvState = Join-Path (Resolve-Path .private).Path "tv-session.json"
node tools/native-session.cjs --help
node tools/native-session.cjs pair-start --tv 192.168.1.50 --state "$tvState"
```

`pair-start` creates the state file exclusively and requests an on-screen PIN. Enter the PIN currently displayed on the television in place of `TV_PIN`:

```powershell
node tools/native-session.cjs pair-code --state "$tvState" --pin TV_PIN
```

On other operating systems, supply an absolute state-file path inside a private directory. Keep state, authentication tokens, PINs, local addresses, and raw television configuration out of commits, issues, screenshots, and CI logs.

## 4. Open the public HTTPS guide

With the paired state selected:

```powershell
node tools/native-session.cjs launch-page --state "$tvState" --url https://knewportdev.github.io/home-streaming-lab/
```

This verifies the target and asks Conjure to open the public HTTPS URL. It starts no PC asset server and sends no pairing credentials to GitHub Pages. The PC can stop serving because this route does not use it to host assets.

Check the physical TV screen, then test directional navigation, program dialogs, Settings, theme controls, and Back. The shared configuration keeps native app controls disabled. An accepted launch request or a matching `/app/current` response establishes the control path, not what appeared on screen.

Pages has no execution-receipt endpoint. Record the revision and the screen/remote behavior actually observed. Physical TV rendering is still unverified in the current project record.

## Optional local delivery test

Both devices must be reachable on the same LAN. Replace `192.168.1.20` with the development PC's LAN address. Local serving needs `home/index.html`, `home/home.css`, `home/home.js`, and personal `home/config.json`.

Create an initial configuration only if there is no existing personal file:

```powershell
if (-not (Test-Path home/config.json)) { Copy-Item home/config.example.json home/config.json }
node tools/native-session.cjs serve-launch --state "$tvState" --bind 192.168.1.20 --port 8137 --home ./home
```

The helper serves those four assets under a random path and requests Conjure to open the page. It injects a small readiness callback. A callback from the expected TV is recorded as `tv_javascript_ready`; a PC request does not count. Appearance and remote controls still need a screen check.

The PC must keep serving throughout this local test and allow the TV to reach the chosen port. The helper makes no firewall changes. Ctrl+C stops only the PC server. During the earlier test, the PC answered locally but no TV callback arrived; an explicit inbound Node block was observed on Windows. The HTTPS route avoids that inbound serving requirement.

The native API adapter has a separate origin guard and remains disabled in public and PC-hosted previews. Running a browser page does not establish internal API compatibility or persistent installation.

## Pairing recovery

### Retry a failed initial start

```powershell
node tools/native-session.cjs pair-retry --state "$tvState"
```

This is available only for an existing `starting` state without a token or challenge. It reuses the same client identity and performs one start attempt. Paired and awaiting-PIN states are preserved and refused. A successful start may display a new PIN.

`BLOCKED` means pairing is already in progress on the TV; retry does not clear that condition. An incomplete successful response preserves available challenge fields privately and stops further retries. Use only the real displayed PIN and saved challenge. Windows state updates use a verified existing file handle following the observed `EINVAL` fix.

### Refresh an old saved PIN challenge

If state is `awaiting_pin` and the displayed PIN is no longer current:

```powershell
node tools/native-session.cjs pair-restart --state "$tvState"
```

The helper verifies the TV, saves a private recovery snapshot, waits 30 seconds, and makes one pairing-start request using the same client identity. This follows [VIZIO's launcher recovery flow](https://vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html). Use the new PIN shown on screen.

If the TV returns `BLOCKED`, dismiss its current pairing screen with Back on the physical remote before explicitly trying again. A lost response or failed state write blocks automatic replay. Do not delete state to force a restart. Paired sessions and incomplete challenges are refused.

## Native preparation bundle

```sh
node tools/package-native-home.cjs --out native-home-package
```

Use a new or empty directory. The output contains the current interface, shared configuration, instructions, license, and a SHA-256 content manifest. It is a preparation bundle, not firmware or an installer. App controls stay disabled until the origin and integration are verified on the TV.

## Optional USB diagnostic preparation

```sh
node tools/make-usb-diagnostic.cjs --out ./new-usb-diagnostic
```

This creates only a fixed read-only capability CGI and its instructions in a new or empty directory. It makes no TV request. Copying files to USB does not establish code execution; the actual mount and an applicable execution route must be observed before invocation. No flash operation, boot change, network shell, or persistence mechanism is included.

## Interpreting the checks

| Result | What it establishes |
| --- | --- |
| Metadata response | Identity and version fields returned by the device. |
| Pairing completed | This private client state can authenticate to the TV control API. |
| Launch accepted / matching current-app result | The TV accepted or reports the requested Conjure application. |
| Local `tv_javascript_ready` callback | The expected TV executed the injected readiness callback. |
| Physical screen and remote check | The particular observed layout and controls worked on the TV. |
| Capability CGI output, if ever obtained | The fixed script executed in that context; root requires an identity reporting `uid=0`. |
| Passing CI or a generated bundle | Repository behavior and packaging passed the recorded checks. |

Root, a tested backup/restore route, bootloader control, permanent Home replacement, and complete OS replacement remain separate milestones. See [native-system evidence](NATIVE-SYSTEM.md) and [issue #1](https://github.com/KnewportDev/home-streaming-lab/issues/1).
