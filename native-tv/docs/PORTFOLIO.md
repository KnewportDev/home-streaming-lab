# Portfolio summary

## Project

**Vizio Native — a networked-TV development homelab**

An ongoing project to build a custom interface in a VIZIO TV's own browser and document what the actual hardware supports. The work combines LAN discovery, API integration, Windows troubleshooting, local credential handling, JavaScript interface development, and repeatable offline checks. The current design is a 2000s Suddenlink-style cable guide with clearly labeled sample listings; it does not provide television playback or a real schedule feed.

Public repository: [KnewportDev/home-streaming-lab](https://github.com/KnewportDev/home-streaming-lab), under `native-tv/`.

[Public preview](https://knewportdev.github.io/home-streaming-lab/) · [Verified build and deployment](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42144758476)

## Resume bullet

Built a dependency-free Node.js homelab toolkit for VIZIO TV discovery and authenticated launch requests; diagnosed Windows state-write and network-delivery issues, and published a browser-verified cable-guide interface through GitHub Actions with 39 passing offline tests.

## 60-second project explanation

“I wanted a custom home interface that could run in my TV's own browser, so I started by finding out what the hardware actually exposed. I built bounded SSDP discovery and GET-only metadata checks, then used those results to constrain the pairing client to the model and firmware I had observed.

“One useful debugging case was a pairing attempt that displayed a PIN on the TV but failed in the client. The problem was saving state: on the Windows machine, one numeric file-open flag combination returned EINVAL. I isolated that with disposable files, changed the update to use a checked file handle, and added a regression that runs offline.

“Pairing works, and the authenticated current-app API confirms Conjure after an accepted launch. The TV could not load the PC-hosted page, so I checked the delivery path and found an inbound Node block. Public HTTPS delivery avoids that path without changing the firewall or requiring an always-on PC. The current 2000s cable guide passed 39 tests in CI and deployed to Pages. Browser checks cover navigation, program dialogs, Settings, and the empty app state. Its listings are samples; real content is not connected. Actual TV-screen observation is still pending.”

## Evidence a reviewer can inspect

| Skill | Evidence |
| --- | --- |
| LAN discovery and request boundaries | [Inspection implementation](../tools/inspect-tv.cjs) and [discovery regression tests](../tools/test-inspect-tv.cjs). |
| API integration and recoverable state | [Pairing/session client](../tools/native-session.cjs) and [session tests](../tools/test-native-session.cjs). |
| Windows fault isolation | [Failure, fix, and validation notes](ENGINEERING-NOTES.md#windows-pairing-state-write-failure). |
| Interface development | [Cable-guide source and controls](../home/), labeled sample data, and the preview command in the [README](../README.md#start-with-the-local-preview). The deployed layout, directional navigation, program dialogs, Settings, and app empty state were browser-verified. |
| Repeatable delivery | Repository-root `.github/workflows/native-tv.yml`: checks, six allowlisted preview assets, and main-only Pages publishing. [Run 42144758476](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42144758476) passed 39 tests and deployed commit `25c58b0cd4fcbeb21e5a843c0c6d1df40ff42bd7`. |

## Current result and next milestone

The target is V405-H9 on firmware `1.720.9.1-1`. PIN pairing completed and a launch request was accepted. The latest authenticated current-app read returned `SUCCESS`, app 17 / namespace 4, and the exact public guide URL; no relaunch was sent during that read-only check. A separate PC request confirmed HTTP 200 and the expected guide markup. The earlier local attempt returned no callback and the owner reported “no network detected.” The source and HTTPS guide are public. The current cable-guide revision passed 39 tests in CI and deployed successfully; its five guide tests also passed on Windows, separately from the earlier 24 passing Windows session tests. The earlier CI baseline was 34 passing tests. Actual TV rendering and physical remote behavior remain unverified.

On **5 November 2026**, the design changed to a six-channel sample guide with three half-hour columns, yellow focus, a program-information panel, decorative color bars, and Guide/My Apps/Settings navigation. Cable Blue, Night Guide, and Classic Gray replace the earlier appearance labels. The deployed browser version passed review of its layout, directional navigation, dialogs, Settings, and app empty state; the user approved the retro look. A local review capture is retained as `knewport-retro-cable-guide.png`. The app catalog remains empty, with native API controls disabled in the public preview. Root access, firmware replacement, and a persistent Home modification have not been established.

The current delivery path requires no PC asset server. Personal continuous channels and media-server operation are deferred; no actual EPG, television feed, or playback source is connected. The next hardware milestone is observing the deployed guide on the TV and testing its physical remote controls.

As milestones are verified, update this summary with the tested commit and hardware observations. Use the linked implementation and engineering notes to explain the design decisions and remaining work.
