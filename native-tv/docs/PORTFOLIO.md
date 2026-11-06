# Vizio Native — portfolio summary

A personal TV overhaul project combining a retro cable guide, LAN discovery, authenticated device control, and a GitHub development workflow. The goal is to have the VIZIO itself boot into a custom system, with a self-hosted media server added later.

[Repository](https://github.com/KnewportDev/home-streaming-lab) · [Browser preview](https://knewportdev.github.io/home-streaming-lab/) · [Native-system issue #1](https://github.com/KnewportDev/home-streaming-lab/issues/1)

## Resume bullet

Developing a VIZIO TV overhaul with dependency-free Node.js tools for LAN discovery, authenticated control, and private session storage; published a retro cable-guide interface through GitHub Actions with Linux and Windows checks, reproducible interface packaging, and documented native-system requirements.

## Project explanation

“I want my TV to boot into a system I control, starting with the blue-and-yellow cable guide I remember from the 2000s. The project uses the TV's reported model and firmware to guide compatibility work, and the source lives in my GitHub repository.

“The working pieces are a browser interface, bounded network discovery, ordinary PIN pairing, and authenticated launch requests. A useful troubleshooting case involved a PIN appearing on the TV while the client failed to save its state. Testing the file-open operation on Windows isolated an EINVAL error; the fix uses a checked file handle, with an offline regression for that failure.

“The guide is published on GitHub Pages, so it doesn't need a PC running to serve its assets. The development pipeline checks Linux and Windows before publishing. A separate TV check screen helps distinguish page loading, JavaScript, remote input, and local API access. The next stage is proving native execution and recovery on the actual TV before making anything persistent. A personal media server and real channel schedules come later.”

## Work covered

| Area | Implementation and evidence |
| --- | --- |
| Network discovery | Bounded SSDP searches, private IPv4 validation, and fixed metadata requests in [inspect-tv.cjs](../tools/inspect-tv.cjs). A regression covers the TV's bare port-9080 announcement. |
| Device API integration | Model/firmware checks, PIN pairing, private session state, and Conjure launch requests in [native-session.cjs](../tools/native-session.cjs). |
| Windows troubleshooting | [Engineering notes](ENGINEERING-NOTES.md#windows-pairing-state-write-failure) document the failed state write, the isolated file-operation test, and the checked-handle fix. |
| Interface development | [Guide source](../home/) implements directional navigation, visible focus, information dialogs, themes, and an empty app state. The listings are labeled samples. |
| Native capability research | [Platform inspection](../tools/inspect-native-platform.cjs) reads informational endpoints from the paired TV. [Native-system evidence](NATIVE-SYSTEM.md) records model-specific findings and missing proof. |
| Browser troubleshooting | Published [TV Check](https://knewportdev.github.io/home-streaming-lab/tv-check.html) separates page, script, key-event, and optional local metadata receipts. Desktop rendering, key receipts, return navigation, and absence of automatic local requests were checked; no credentials or telemetry. |
| Source provenance | Acquired the published 5691 / FUR7.2 archive and matched both pinned checksums with a bounded offline verifier. [Direct inspection](SOURCE-INSPECTION.md) traces Home selection, asset verification, and the MT5691 BSP with file hashes. Exact installed-build compatibility remains unverified. |
| Reproducible packaging | [Native preparation tool](../tools/package-native-home.cjs) assembles shared interface assets and a SHA-256 content manifest without private configuration or session data. |
| GitHub delivery | Repository-root `.github/workflows/native-tv.yml` runs offline checks, attaches artifacts, and publishes the browser preview from `main`. It has no TV credentials. |

## Results so far

The TV reports **V405-H9**, firmware **1.720.9.1-1**, and ViziOS **mtk5691-1.6.1770.1**. PIN pairing completed and authenticated guide and TV Check launches were accepted. An authenticated current-app verification at **2026-11-06T03:23:03.364Z** matched Conjure app 17, namespace 4, and the exact public TV Check URL ([redacted launch report](evidence/tv-check-launch-2026-11-06.json)). These checks verify the control path.

A later [owner-supplied photo](evidence/tv-check-owner-photo-2026-11-06.json) shows TV Check on the physical television with Page: Open, JavaScript: Running, and Down received / 14 key events. That closes the basic diagnostic rendering and key-receipt checks. Local API says Not checked, and no K1 badge is visible; the exact rendered revision, full guide workflow, and local API access remain unverified. The private room photo is not included in this repository.

[PR #3](https://github.com/KnewportDev/home-streaming-lab/pull/3) merged with **69 Linux tests and 68 Windows tests** passing in [PR validation](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42155733173) and [main run 42155846531](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42155846531); the main run published Pages. Browser review covered the guide layout, directional navigation, program dialogs, Settings, and empty My Apps state. The published TV Check page also showed Page: Open and JavaScript: Running, updated arrow-key receipts and focus, and returned to the original guide when OK selected Back. No automatic local request occurred. The [desktop screenshot](ENGINEERING-NOTES.md#passive-network-status-and-visible-execution-checks--6-november-2026) documents this browser check, not the TV screen.

The inspector completed all four informational requests on the actual TV; its [redacted report](evidence/native-platform-2026-11-06.json) is included as evidence.

[PR #5](https://github.com/KnewportDev/home-streaming-lab/pull/5) added source verification and the short TV-screen result code. Its [main run 42159281900](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42159281900) passed **88 Linux tests and 87 Windows tests**, with no failures or skips, and published Pages. The real 7.95 GB publisher ZIP subsequently matched both pinned digests. Static review identified the Home-controller boundary, signed asset verification, and the separate `mt5691_cast` / `m7632` BSP target. The ViziOS build's `mtk5695` default needs further resolution; no firmware build or install is claimed.

An additional [seven-request inspection](evidence/native-network-2026-11-06.json) found that the TV reported a connected local network. The connection-type value remained unknown under the report's whitelist. That report alone does not prove Internet access or browser rendering. The later photo supplies separate screen evidence; a photo after selecting Check TV connection is still needed for the optional Local API result.

The PC-hosted delivery test received no TV readiness callback. An inbound Node block was observed on Windows, and no firewall rules were changed. Public HTTPS delivery removes the need for a PC asset server. Detailed commands and pairing-state reuse are in [TV setup](TV-SETUP.md).

Root, a tested backup/restore procedure, bootloader control, an internal installation, and a permanent Home replacement remain unverified. The interface package is not a replacement OS. Those distinctions are part of the project record and determine the next hardware steps.

## Direction

Keep the Suddenlink-style guide as the interface while working toward native boot and local operation on the TV. First verify the screen and remote, then establish a supported execution path and recovery method. A complete system replacement also needs working support for the panel, inputs, audio, storage, networking, and power control.

A self-hosted server for personal media, schedules, and guide data is a later phase. No real television feed, playback source, or electronic program guide is connected yet, and no continuously running PC is required for the current public guide.

## References and licensing

The visual reference is the [classic i-Guide manual](https://www.wadsworthcity.com/DocumentCenter/View/1540/I-Guide-Manual---Manual-for-the-Digital-Guide-Our-Digital-Settop-Boxes-Use-PDF). Protocol work references [VIZIO's launcher](https://vizio-pm.s3-us-west-1.amazonaws.com/conjure-launcher.html), the [SmartCast API documentation](https://github.com/exiva/Vizio_SmartCast_API), and [Vizio Open Home](https://github.com/jordanmateo-byte/vizio-open-home). Its reported hardware support is for a different model and firmware. The [README](../README.md#references-and-credits) keeps the full research credits.

Original project code is [MIT licensed](../LICENSE). The source includes no third-party firmware or proprietary binaries.
