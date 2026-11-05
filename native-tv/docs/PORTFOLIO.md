# Portfolio summary

## Project

**Vizio Native — a networked-TV development homelab**

An ongoing project to build a custom interface in a VIZIO TV's own browser and document what the actual hardware supports. The work combines LAN discovery, API integration, Windows troubleshooting, local credential handling, JavaScript interface development, and repeatable offline checks.

Repository: [KnewportDev/home-streaming-lab](https://github.com/KnewportDev/home-streaming-lab), under `native-tv/`.

## Resume bullet

Built a dependency-free Node.js homelab toolkit for VIZIO TV discovery, metadata inspection, and PIN-pairing state management; diagnosed a Windows file-write failure, added a 30-test offline suite, and implemented a GitHub Actions pipeline that packages a local browser-interface preview.

## 60-second project explanation

“I wanted a custom home interface that could run in my TV's own browser, so I started by finding out what the hardware actually exposed. I built bounded SSDP discovery and GET-only metadata checks, then used those results to constrain the pairing client to the model and firmware I had observed.

“One useful debugging case was a pairing attempt that displayed a PIN on the TV but failed in the client. The problem was saving state: on the Windows machine, one numeric file-open flag combination returned EINVAL. I isolated that with disposable files, changed the update to use a checked file handle, and added a regression that runs offline.

“The project now has 30 passing offline tests, a remote-friendly interface, and an automated preview pipeline. Completing authenticated launch and proving the interface runs on the TV are the next milestones. I keep those hardware results separate from what a local preview or a passing test can prove.”

## Evidence a reviewer can inspect

| Skill | Evidence |
| --- | --- |
| LAN discovery and request boundaries | [Inspection implementation](../tools/inspect-tv.cjs) and [discovery regression tests](../tools/test-inspect-tv.cjs). |
| API integration and recoverable state | [Pairing/session client](../tools/native-session.cjs) and [session tests](../tools/test-native-session.cjs). |
| Windows fault isolation | [Failure, fix, and validation notes](ENGINEERING-NOTES.md#windows-pairing-state-write-failure). |
| Interface development | [Local interface source](../home/) and the preview command in the [README](../README.md#start-with-the-local-preview). |
| Repeatable delivery | Repository-root `.github/workflows/native-tv.yml`: scoped checks and an explicit preview asset allowlist. A specific hosted run should be cited only after it has completed. |

## Current result and next milestone

The observed target is V405-H9 on firmware `1.720.9.1-1`. Network metadata and the Windows failure were observed directly; the file-handling fix and other boundaries have offline regression coverage. PIN pairing is pending completion. No completed TV installation, root access, firmware replacement, or persistent Home modification is claimed.

As milestones are verified, update this summary with the tested commit and hardware observations. Use the linked implementation and engineering notes to explain the design decisions and remaining work.
