# Native system target and evidence

Assessed: **2026-11-06**.

## Intended result

The owner's goal is for the **TV itself** to boot and run their own retro interface
as its normal system, without a PC running continuously. An external streaming
device does not fulfill that goal. The frontend in this repository is a candidate
interface, not an operating system, bootloader, hardware port, or flashable image.

The live, read-only API inspection identified:

| Field | Observed value |
| --- | --- |
| Model | **VIZIO V405-H9** |
| Firmware | **1.720.9.1-1** |
| ViziOS platform version | **mtk5691-1.6.1770.1** |

Use this observed identity for compatibility decisions. Earlier V405-H19 references
were an unconfirmed working assumption. The platform string is not a substitute
for the actual mainboard revision or a boot log.

## Current conclusion

**A matching-family source release is available; native installation remains unverified.**
The research found no reproducible root procedure, bootloader unlock, bootable
replacement OS, or demonstrated USB/serial recovery procedure matching this exact
model and firmware. This is a gap in available evidence, not proof that such work
is impossible.

No root session, original-storage backup, restore test, unsigned-kernel boot, or
native installation has been demonstrated on the owner's unit. Read-only GET
requests to `/install` and `/scpl` returned 404; selected SSH, telnet, ADB, and debug
port checks timed out. Those responses do not establish that every execution path
is closed, or that a particular vulnerability is patched. They also establish no
control over the boot process.

A green CI run, an open PR, and a desktop preview validate repository behavior.
They do not establish TV compatibility or install anything on its storage.

## Current software evidence and next screen check

The [four-read platform report](evidence/native-platform-2026-11-06.json) succeeded
on the paired target. The optional `--network` run then completed seven fixed,
passive reads with no TV writes. Its [redacted report](evidence/native-network-2026-11-06.json)
records `reportedConnected: true`; connection type stays unknown because its value
did not match the output allowlist. This establishes the TV's reported local
connection status, not DNS, TLS, Internet access, or page rendering.

Standalone [TV Check](../home/tv-check.html) is published at
[the public check URL](https://knewportdev.github.io/home-streaming-lab/tv-check.html)
following [PR #3](https://github.com/KnewportDev/home-streaming-lab/pull/3) and
[main run 42155846531](https://github.com/KnewportDev/home-streaming-lab/actions/runs/42155846531),
which passed 69 Linux tests, 68 Windows tests, and Pages deployment.
It provides visible page, JavaScript, and remote-key receipts without automatic
probes or credentials. An explicit **Check TV connection** button can make one
fixed unauthenticated GET to `http://127.0.0.1:7346/state/device/deviceinfo`, limited
to 3 seconds and 128 KiB. Browser status `0` is ambiguous and does not prove there
is no Internet connection. Even a successful read would establish only access to
that endpoint from the page's browser context.

Desktop review observed page and JavaScript receipts, arrow-key receipt/focus
changes, no automatic local request, and OK on Back returning to the original
guide. The paired TV accepted its launch. Authenticated `/app/current` at
**2026-11-06T03:23:03.364Z** matched app 17, namespace 4, and the exact public
TV Check URL ([launch evidence](evidence/tv-check-launch-2026-11-06.json)).
Physical TV rendering, physical remote behavior, and the optional Local API result
remain pending. Send the short `K1-...` result code or a photograph from the actual television next;
`/app/current` reports launch metadata, not what the screen displayed.
The guide's origin restriction is a project policy,
not a measured H9 limitation; native controls remain disabled. The approved guide
is preserved, and its eight-file preparation bundle now includes this check page.
Root, bootloader control, recovery, native installation, persistent Home behavior,
and complete OS replacement remain unverified.

## Source compatibility record

| Source | What it establishes | Relevance to this target |
| --- | --- | --- |
| [ViziOwn, original Exploitee.rs research](https://bh2017.exploitee.rs/2021/viziown-exploiting-vizio-smartcast/) | A 2021 SmartCast root technique, with different payloads discussed for SX7 and MT588X. | No exact V405-H9 / 1.720.9.1-1 match or replacement-OS boot proof. |
| [ELTON USB advisory](https://www.eltoncyber.com/advisories/vizio-tv-code-execution-from-a-usb-drive) | USB-hosted CGI execution and root demonstrated on 2017 E50x-E1 and 2018 P65-F1. | Different models. A USB port or similar URL alone does not establish eligibility here. |
| [Vizio Open Home](https://github.com/jordanmateo-byte/vizio-open-home) | Project reports USB CGI root and an internally stored home replacement on M657-G0, SX7B, firmware 7.0.120.1-1, group 271. | Different platform and firmware. Its successful launcher retains the underlying TV system; it does not demonstrate a complete alternative OS. |
| [Vendor-supplied source mirrored in vizio_oss](https://github.com/unitedcolorsofg/vizio_oss) | Maintainer identifies a June 6, 2016 VIZIO source release: Linux 3.0.13 and U-Boot for listed MT53xx/MT588x chips. | Not an MT5691/V405-H9 board-support package or a ready image for this TV. |
| [Linux MediaTek board bindings](https://github.com/torvalds/linux/blob/master/Documentation/devicetree/bindings/arm/mediatek.yaml), [U-Boot MediaTek configuration](https://github.com/u-boot/u-boot/blob/master/arch/arm/mach-mediatek/Kconfig), [mtkclient chip configuration](https://github.com/bkerler/mtkclient/blob/main/mtkclient/config/brom_config.py) | Current named-target files were inspected for MT5691, V405, and VIZIO. No matching entry was found in those files. | No verified generic Linux/U-Boot/mtkclient route was identified. A different chip alias could require further investigation; this check is not proof of impossibility. |
| [MediaTek August 2023 bulletin](https://www.mediatek.com/product-security-bulletin/August-2023) | Includes MT5691 in several affected-chip lists; for example, CVE-2023-20811 requires existing System execution privileges and names Android 10/11 or Linux 4.19. | A chipset listing does not prove this VIZIO firmware is affected, unpatched, or remotely rootable. |
| [Firsthand repair report, post 915](https://forosdeelectronica.com/threads/tv-debugging-tool.181567/page-46) | A September 9, 2025 poster reports a locked debug console on a VIZIO board identified as tpd.mt5691t.pc763. No remedy appears on that page. | Related board-family evidence only: no model/firmware match. UART must not be described as guaranteed root or recovery. |

The [published 5691 FUR7.2 source release](https://github.com/opensource-vizio/5691_FUR7.2_OpenSourceSoftware/blob/1d05e3cb76d453a8d6a76f38dd2b8409b428bb11/README.md)
lists firmware family `1.720.X.Y`. Its chipset and release mapping match the
observed target family. This supersedes the earlier search that did not find a
matching-family source release. The archive has not been acquired or inspected;
the download form requires contact details and has not been submitted.
[Source intake](SOURCE-INTAKE.md) records the pinned publication, checksum
verifier, acquisition step, and questions to investigate in the source.

No exact-build image, execution/root route, signing authority, or recovery
procedure follows from the family match. VIZIO's [firmware search](https://support.vizio.com/s/firmware-search?language=en_US)
previously returned a loading/CSS error in the research fetch. No official
recovery image for this exact unit has been obtained or verified.

A fresh bounded read of the documented development entry at port 9555 failed
while authenticated current-app metadata matched the check page
([redacted result](evidence/development-entry-2026-11-06.json)). No debug setting
was enabled and no screen evidence was obtained. The documented development-TV
route does not establish access on this retail set.

## Gated progression

1. **Read-only evidence.** Keep the observed identity and collect actual platform,
   board, and execution evidence. If a diagnostic ever runs, its output proves
   execution in that context; root requires an identity reporting `uid=0`.
   Neither result by itself proves bootloader control.
2. **Backup and recovery.** Identify the real storage layout, preserve this unit's
   original software and device-specific data, and establish a tested restoration
   route before persistent changes. An OTA update package or factory-settings
   reset is not automatically a full recovery method.
3. **Temporary native operation.** After a supported execution route is proven,
   demonstrate the interface running locally on the TV without persistent edits.
   Verify remote navigation, picture, sound, inputs, and return to the original UI.
4. **Persistent native home.** Only with backup/recovery and a reversible method
   validated for this unit, test boot and Home behavior with the PC and USB removed.
   This is an intermediate milestone that still retains the vendor's underlying
   kernel, drivers, and services.
5. **Complete OS replacement.** Proceed only after verifying a compatible boot
   path and hardware port, including display/panel initialization, HDMI input,
   audio, remote input, storage, networking, and power control. Establish what
   signature checks and recovery requirements actually apply. Root alone is
   insufficient; unrelated firmware, a generic ARM image, or a launcher build
   is not a substitute for this proof.

## Smallest useful hardware evidence

If the existing software evidence cannot establish a native execution or boot
route, the next physical investigation is **identify the exact mainboard and
capture a read-only boot log through a correctly identified service interface**.
That work needs the board revision, documented pinout, and electrical levels;
none are established here. A technician's board identification and boot-log
capture can answer whether an accessible console or recovery loader exists.
Do not assume that opening the case, connecting UART, or inserting a USB drive
will unlock it. This document supplies no wiring, bypass, erase, or flash commands.

The immediate software work can continue in version control while these hardware
questions remain open. The full native system goal remains open until it is
demonstrated on this exact TV.
