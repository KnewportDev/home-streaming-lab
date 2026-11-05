# Local Home for Vizio — native launcher candidate

**Deployment and compatibility are UNVERIFIED on VIZIO V405-H9.** This is executable launcher source for the stock TV browser, with a documented native API adapter. It is not replacement firmware, an Android installation, a root exploit, or evidence that a TV was modified.

## Runtime

Serve these files from the TV's existing internal static server only after a separate, model-specific installation route is verified. The reference project runs a Home page at `http://127.0.0.1:12345/scfs/codex-home/index.html`. This package does not install files or change that server. Opening the page on a computer displays its interface but deliberately disables native TV calls.

Copy `config.example.json` to `config.json` beside the page. Initially the catalog is empty, and native access is disabled. Up to 12 apps are accepted. Each app requires `label` (nonempty text) and `launch` containing the TV-observed `NAME_SPACE` integer, `APP_ID` string, and `MESSAGE` string or null. No example app identifiers are included because no identifiers have been verified on the user's TV. Obtain values from the actual television or a confirmed model-specific app catalog; a launch value cannot install an app.

Set `nativeBridge.enabled` to `true` only after native installation and interface support are verified. The origin guard requires precisely HTTP, host `127.0.0.1`, port `12345`. The fixed adapter calls local `http://127.0.0.1:7346/app/get_auth_token`, reads `ITEM.VALUE`, then sends `PUT /app/launch` with header `AUTH` and JSON `{ "VALUE": <observed launch object> }`. It requires `STATUS.RESULT` to equal `SUCCESS` before reporting **request accepted**. It cannot confirm the resulting app actually opened. Tokens stay in memory for that launch and are never persisted. There is no paired-token PC API, proxy, fallback transport, Internet request, analytics or remote resource.

## Remote

Arrow keys navigate only populated tiles, with up to four columns on a TV. Up from the first row reaches the profile/settings button; Down returns to the selected tile. Enter/OK activates the focused control. Back (key codes 8, 27, 461, 10009) opens/closes Settings. The empty catalog shows one working This TV button beside a noninteractive empty state. Settings contains local appearance controls and the reported model/firmware; it sends no native settings command. Modal focus is contained and restored to its opener. In Settings, Up moves to Close, Down returns to the selected accent, and Left/Right moves between the accents. The page uses system fonts and ES5-style JavaScript.

## Appearance and development

The visual direction is early-2000s media-center software: blue glass, chrome edges, soft light trails and a strong remote-focus glow. Aqua, Cobalt and Silver are local accent choices. The stable internal theme keys are `sage`, `glacier` and `amber` respectively. Only the selected accent is stored, under `local-home.accent`; no credentials are stored by the page. Storage failure leaves the interface usable for the current session. The clock and greeting use the rendering device's local time.

From the `native-tv` project directory, run `node tools/preview-home.cjs`, then open the printed localhost URL on that computer. It serves only the four interface assets and never sends commands to the TV. Restart the preview process after editing files. This browser preview does not prove on-TV compatibility.

## Primary compatibility evidence

- [Open Home architecture](https://github.com/jordanmateo-byte/vizio-open-home/blob/main/docs/ARCHITECTURE.md): stock-browser HTML/CSS/JS runtime and internal static origin. Its published hardware validation is M657-G0 / SX7B firmware 7.0.120.1-1, not V405-H9.
- [Open Home runtime source](https://github.com/jordanmateo-byte/vizio-open-home/blob/main/src/runtime.js): exact local authorization and app-launch endpoints, request body, token extraction and success response.
- [Exiva SmartCast API](https://github.com/exiva/Vizio_SmartCast_API): external paired SmartCast control API. This package uses the on-TV local interface above, not external HTTPS control.

The interface and implementation here are original. Native integration follows the cited protocol evidence. There are no copied upstream assets, app identifiers or installed vendor components. Actual firmware behavior, remote key delivery, origin policy, local API access and installation persistence still require verification on the user's TV. No root, flash or boot modification has been performed by this package.

## License — MIT

Copyright (c) 2026 Local Home contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Local execution receipt

After the UI initializes and its relative `config.json` request finishes, the page sends a relative `GET telemetry?event=ready`. This stays on the serving origin and contains no identifiers, token values, or key contents. A receipt proves this code executed; it does not establish successful app launch or native installation. Receipt failure does not block the interface. The page does not create or read cookies. With an empty catalog, the page shows one TV-information control instead of placeholder apps. `testMode` displays a Preview badge and the optional `device` object supplies the observed model/firmware for the information panel.

## Current hardware identification

A read-only device-information check reported model `V405-H9`, firmware `1.720.9.1-1`, ViziOS `mtk5691-1.6.1770.1`. Native loopback compatibility and persistent installation on this hardware remain unverified. A PC-hosted Conjure session is the planned first on-TV test and does not satisfy the native-origin gate.
