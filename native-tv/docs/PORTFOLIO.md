# Portfolio summary

## Project

**Vizio Native — a networked-TV development homelab**

An ongoing project to build a custom interface in a VIZIO TV's own browser and document what the actual hardware supports. The work combines LAN discovery, API integration, Windows troubleshooting, local credential handling, JavaScript interface development, and repeatable offline checks.

Public repository: [KnewportDev/home-streaming-lab](https://github.com/KnewportDev/home-streaming-lab), under `native-tv/`.

[Live interface](https://knewportdev.github.io/home-streaming-lab/) · [Passing build and deployment](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42124719065)

## Resume bullet

Built a dependency-free Node.js homelab toolkit for VIZIO TV discovery and authenticated launch requests; diagnosed Windows state-write and network-delivery issues, added 34 offline tests, and implemented a GitHub Actions workflow for preview packaging and Pages publishing.

## 60-second project explanation

“I wanted a custom home interface that could run in my TV's own browser, so I started by finding out what the hardware actually exposed. I built bounded SSDP discovery and GET-only metadata checks, then used those results to constrain the pairing client to the model and firmware I had observed.

“One useful debugging case was a pairing attempt that displayed a PIN on the TV but failed in the client. The problem was saving state: on the Windows machine, one numeric file-open flag combination returned EINVAL. I isolated that with disposable files, changed the update to use a checked file handle, and added a regression that runs offline.

“Pairing now works, and the authenticated current-app API confirms Conjure after an accepted launch. The TV could not load the PC-hosted page, so I checked the delivery path and found an inbound Node block. I added public HTTPS delivery without changing the firewall. The pipeline now passes 34 tests and deploys the interface to Pages; I checked its settings and theme controls in a desktop browser. The TV accepted the HTTPS launch request, and the next milestone is observing the actual TV screen.”

## Evidence a reviewer can inspect

| Skill | Evidence |
| --- | --- |
| LAN discovery and request boundaries | [Inspection implementation](../tools/inspect-tv.cjs) and [discovery regression tests](../tools/test-inspect-tv.cjs). |
| API integration and recoverable state | [Pairing/session client](../tools/native-session.cjs) and [session tests](../tools/test-native-session.cjs). |
| Windows fault isolation | [Failure, fix, and validation notes](ENGINEERING-NOTES.md#windows-pairing-state-write-failure). |
| Interface development | [Local interface source](../home/) and the preview command in the [README](../README.md#start-with-the-local-preview). |
| Repeatable delivery | Repository-root `.github/workflows/native-tv.yml`: checks, six allowlisted preview assets, and main-only Pages publishing. [Run 42124719065](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42124719065) passed the 34-test job and deployed commit `3dfa54ff948a9d4a8e867678b226c8c6ecef22ee`. |

## Current result and next milestone

The target is V405-H9 on firmware `1.720.9.1-1`. PIN pairing completed, a launch request was accepted, and an authenticated read confirmed app 17 / namespace 4. The local attempt returned no JavaScript callback and the owner reported “no network detected.” The source and HTTPS preview are public. The live page's settings, Cobalt theme, and Escape/focus behavior were checked in a desktop browser. The TV accepted the HTTPS launch request, but on-TV rendering remains pending. Root access, firmware replacement, and a persistent Home modification have not been established.

As milestones are verified, update this summary with the tested commit and hardware observations. Use the linked implementation and engineering notes to explain the design decisions and remaining work.
