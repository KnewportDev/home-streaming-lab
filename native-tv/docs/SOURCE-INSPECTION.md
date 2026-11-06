# Source inspection: 5691 / FUR7.2

Inspected on **6 November 2026**. This is a static source review for the observed
V405-H9 / firmware `1.720.9.1-1` target. No vendor program was executed and no TV
request was made during acquisition or this inspection.

## Archive verified

The publisher's normal download flow was completed with the owner's approval.
The ZIP was downloaded directly to the development PC and checked by
`tools/verify-source-bundle.cjs` before inspection.

| Field | Observed value |
| --- | --- |
| File | `5691_OSS_FUR7.2.zip` |
| Size | 7,946,973,901 bytes |
| MD5 | `5b62eb08af859ee6cd49e654c45c76b1` |
| SHA-1 | `38c0a3e5cefd2eafa9acdad074ed88cea90c7b63` |
| SHA-256 | `974b76513f493e24494dcb2edce67add04795be4f6f60e07b95961131fe456bf` |
| Publisher comparison | Both pinned published digests match |
| Outer ZIP entries | 18 |

The [acquisition receipt](evidence/source-archive-2026-11-06.json) links the pinned
publisher record. Contact details, registration identifiers, signed URLs, and
local paths are excluded. The archive and vendor source remain private, outside
the original MIT code. A digest match does not establish exact installed-build
equivalence, boot acceptance, signing authority, or a recovery procedure.

The previously cited independent copy had a different ZIP size and SHA-256.
This review uses the newly acquired publisher archive. Comparable Home source
files matched that earlier record's individual hashes, but the earlier record is
not the evidence for our archive's integrity.

## Inspection scope

The ViziOS source TAR contains 177,009 entries. Fourteen selected source and
documentation files were extracted after checking their regular-file types;
their paths, sizes, and hashes are in the
[source-selection receipt](evidence/source-selection-2026-11-06.json).
Scoped follow-up reads trace their concrete dependencies. The
[component receipt](evidence/source-components-2026-11-06.json) records the
additional Home, updater, build, and SCPL selections. This is not an audit of
every archive member. No vendor build script or executable was run.

The board-support TAR contains `readme.md` and `release.tar.gz`. Its nested
archive inventory contains 507,731 entries. The MT5691 build configuration,
Makefile, Dockerfile, shared make include, and selected boot configuration were
read separately. The outer `Scpl.zip` contains 47 entries; its package inventory
and two README files were also inspected. Selected reads used fixed archive
members and byte limits, without running their contents.

## Home routing

The selected source establishes a producer and consumer chain:

1. `feature-manager/src/main.cpp`, `handleOrchestratorConfigUpdate` (375–415), reads
   `Orchestrator.HomePage` from configuration and writes the orchestrator's
   HomePage registry setting. Its helper can create a temporary-storage node.
2. `platform_orchestrator/src/appsdatabase.cpp` (1282–1345) resolves `spock://homePage` and
   merges a URI parameter into the application holding that alias. Default Home
   uses Loki; the SCTV browser application has a separate controller.
3. Normal `lokiappcontroller.cpp` (294–308, 448–463) removes `uri` from launch parameters.
   `loki_v1` follows a different branch. `browserappcontroller.cpp` consumes the
   URI but rejects a changed URI as an in-place context update.
4. The fallback swap follows the URI update and transfers alias/input/legacy
   identity. It does not transfer each application's controller parameters.

This explains why a Home URL alone is not a general replacement method. A
registry update also does not establish that the running application navigates,
that a missing value restores the earlier state, or that a change survives boot.
These are findings about this source release; the retail TV's active controller
and configuration are still unobserved.

## The MTK5691 request path

`AppsDatabase::publishDatabase` publishes the effective Home-provider identifier
and application database to the system registry. That is a useful metadata target.
The selected `appCurrent` serializer emits only legacy app ID, namespace, and
message. An authenticated `/app/current` read cannot identify the native Home
controller from those fields.

There is a generic internal registry getter in `SysregMultiplexer`: a type-1
request can normalize a URI and return a typed registry value. That initially
looked useful, but the platform factory matters. The inspected source selects a
different backend for MTK5691:

| Source, relative to `rootfs/ViziOS/` | Observed behavior |
| --- | --- |
| `utils/vizios-common/socInfoUtils.h`, 90–140 | Classifies the `/proc/cpuinfo` hardware token `m7632` as `SOC_MTK5691` and `VENDOR_MTK2020`. |
| `platform_orchestrator/src/platformadapter.cpp`, 18–25 | Selects `createPlatformAdapterMtk2020()` for that vendor. |
| `platform_orchestrator/src/platform/mtk/platformadapter_mtk202X.cpp`, 69–94, 508–519, 587–595 | Constructs `Mtk2020Multiplexer`, derived from ordinary `Multiplexer`, and injects it into the SCPL adapter. The readiness callback observes a request and lets it continue. |
| `platform_orchestrator/src/multiplexer.cpp`, 87–95, 148–213 | Constructs `QueueManager`; after JSON/URI validation and explicit redirects, forwards a request toward the backend labeled DtvSvc. It does not perform the generic registry lookup. |

The displayed factory path does **not** select `SysregMultiplexer`. Its generic
getter is therefore not evidence for a usable registry-over-HTTP interface on
this family. This mapping comes from source; the owner's running `/proc/cpuinfo`
and exact installed executable have not been captured.

`POAPIServer::workerThread` uses the native IPC broker, not an HTTP listener.
`SystemAPI` handles serialized system commands, not a Home metadata read.
`ScplAdapter` receives requests through POSIX message queues. The remaining
boundary is the external SCPL/VsspExt URI admission and authentication contract,
plus the downstream DtvSvc operation for any proposed Home read or write.

The inspected `Scpl.zip` package-level inventory consists of Python dependency
archives, checksums, build material, a bill of materials, and README files.
Its README describes dependency libraries for FUR7.2 build 5583. It does not
provide the native route implementation needed by this trace at that level;
the dependency archives were not unpacked. No guessed registry URL was sent
to the TV.

## Asset verification and activation

The selected updater source contains an asset signature verification path.
`unpacker.cpp` reserves a trailing 256-byte signature, splits payload/signature
streams, and supplies the calculated digest to `crypt_utils::verifySignature`.
The helper reads a PEM public key, initializes OpenSSL SHA-256 verification,
feeds it the already-calculated digest bytes, and accepts only a final return
value of 1. The digest calculator itself selects SHA-256. This describes the
observed API sequence; it is not verification of the downloaded source ZIP, and
the actual retail key file/type/padding remain unverified.

The completion result propagates through `DownloadedDataBridge::finalize` and
`GetFileContentAction::onSuccess`. `ActionExecutor::handleResponse` (111–124)
turns a failed final validation into failure, calls the error path, and stops
retrying. The error path cancels the data bridge. Timeout retry is a separate
branch. Data is streamed before final validation; this trace does not establish
complete output cleanup or power-loss safety.

The asset installers separate staging from activation:

| Component | Observed implementation |
| --- | --- |
| `sc_assets_installer.cpp`, 42–172, 217–292 | Stages in the other OSU location, unpacks into a temporary destination, renames in `postInstall`, and adjusts the web-server symlink separately in `sync`. If `readSymlink` yields no value, that sync method returns; it is not an unconditional missing-link creator. |
| `sc_config_installer.cpp`, 38–61, 190–253, 285–310 | Stages SC configuration and ACR files in the other OSU location. `postInstall` is a no-op; live configuration copies occur in `sync`. |
| `manifest_parser.cpp`, 19–52 | Extracts SC-CONFIG/SC-ASSETS metadata and stores `manifest_signature`. This parser does not itself authenticate the manifest. |
| `osu_path_manager.cpp`, 18–31, 93–121 | Defines software asset slots and an active symlink. Rollback either switches that link or removes it to allow built-in assets. Compile-time B-slot paths differ by target. |

The reviewed SC installer forced-update branches affect asset reuse decisions, not signature
checking. SC asset and SC config call sites supply different expected-hash
fields, so their checks should not be described as identical. The introductory
MD5 comment is also insufficient to define the exact bytes being hashed.

OSU slot fallback is **software asset rollback**, not a flash backup or a
demonstrated bootloader/full-TV recovery route. Its link changes are separate
filesystem operations. The updater README assumes an existing root SCP
connection; it does not establish how to obtain one.

### Caller ordering

The concrete caller trace is now established in the selected source:

1. `AssetInstallerManager::startUpdateInternal` (159–214) visits installers in
   their supplied order. It calls each `installAssets`, then that installer's
   `postInstall`; explicit failure returns immediately. The actual registration
   order remains outside this review.
2. `OSUManager::startUpdateNoLock` (340–387) obtains the aggregate result. Both
   the success case and the no-updates case reach `pathManager_.switchPath()`;
   the no-updates case falls through. Explicit aggregate failure skips that
   operation, and a failed path switch becomes failure.
3. A successful switch invokes `commitAssetsInstallation` (492–529), which
   synchronizes the filesystem, then calls the rebooter or sets reboot-related
   state according to update type.
4. `OSUManager::start` invokes `syncInstallers` at startup (100). It is not
   called directly after the path switch. The SC web/config synchronization
   described above therefore belongs to this startup path.

The rollback caller is also present: `rollbackNoLock` (440–462) checks path
validity and pending-reboot state, requests `switchPath(true)`, and invokes the
rebooter. None of these paths was executed on the owner's unit.

This is not a complete failure-atomicity proof. The asset manager's exception
handler logs and returns its current aggregate result without visibly assigning
a failure status. `UpdateResult` aggregation, full object wiring, output-consumer
cleanup, and recovery after interrupted filesystem operations remain unreviewed.

### Manifest admission boundary

`HttpPostManifestProvider::getManifest` (45–125) obtains a response through
`unpacker_.doPost` and passes it directly to `ManifestParser`. It builds request
authentication separately; that is not evidence of response signature checking.
`ManifestManager::isRemoteManifestChanged` (139–211) checks for a missing
manifest, a no-install action, blacklisting, required application entries, and
unchanged hashes, then saves changed manifest content in the other OSU path.
These are structural, policy, comparison, and persistence checks.

No explicit manifest-signature validation was found in the reviewed provider,
parser, or manager bodies. The concrete HTTP implementation/defaults,
`Manifest::Builder::build`, and transport/TLS configuration remain outside this
pass. The supported conclusion is **manifest cryptographic validation is not
established by this review**; it is not a claim that manifests are unsigned or
that a signature check can be bypassed. The separately traced asset signature
verification remains a distinct finding.

## Build targets

The publisher's top-level instructions name Ubuntu 22.04. The ViziOS README names
Ubuntu 20.04 and Docker 24.0.6; the board-support README names Ubuntu 18.04 and
Docker 19.03.6. These are component-specific build instructions, not one verified
build environment for this TV.

The ViziOS `build_gpl_fw.sh` hardcodes **`TARGET=mtk5695`**, exports it into the
Snapcraft builds, and uses it for the output directory. It builds sysroot,
rootfs, and storaged components, then creates an ext2 root filesystem and an
archive. The package's 5691 name is therefore insufficient to assume that this
default invocation produces a suitable H9 image. A shared-target mapping, if
intended, still needs to be established; changing the target string alone is not
a verified port.

There is some shared userspace configuration: `rootfs/snap/snapcraft.yaml`
declares an armhf/core20 output and its direct target conditional distinguishes
`virt`, `mtk5586`, and an otherwise-shared branch. Both 5691 and 5695 take that
last branch. The hardcoded script selection is therefore an unexplained choice,
not proof that its output is incompatible. The sysroot/storaged dependencies
and exact installed-build relationship remain unverified. The script packages
an 80 MiB ext2 root filesystem and a storaged snap into a component archive,
not an established retail update image.

The board-support Makefile has a concrete **`mt5691_cast`** target and sets
**`CHIP=m7632`**. It selects
`.config_m7632_SMP_arm_MI_emmc_nand_utopia2k_iommu` for the kernel and names a
`MT164B_10AT` / eMMC / OP-TEE configuration for the bootloader. Its targets include
kernel, modules, drivers, and U-Boot. This is more specific than the earlier
unsuccessful search for the literal MT5691 name in generic upstream support
lists. It does not identify the owner's physical board or prove that the retail
boot chain accepts rebuilt output.

The shared `include.mak` retains older MT5893 names and an m7332 kernel default.
The target Makefile assigns the m7632 kernel configuration after that include,
so the later assignment wins in the documented default invocation. The selected
boot configuration names `MT164B_10AT_M7632_VIZIO`, Cortex-A53, a 32-bit kernel,
OP-TEE, and security/upgrade options. USB-fastboot options and a bypass-named
flag are configuration values only; their presence proves neither retail access
nor a verification bypass. The implementations and actual device state have
not been traced.

The publisher README also requires `RISK=6.x/stable` for a manual ViziOS build,
while the supplied Dockerfile defaults to `edge`. No build environment was
installed and no build output was generated during this inspection.

## Licensing and handling

The inspected MT5691 configuration declares
`GPL-2.0-only OR BSD-3-Clause`. `scpladapter.cpp` carries an All Rights Reserved
notice, and several inspected ViziOS implementation headers have no SPDX or
license grant. The archive name alone does not settle each component's governing
terms. Vendor code and its notices are retained separately; none is included in
this repository or relabeled under its MIT license.

## Current decision

The generic registry-reader lead is closed for the shown MTK5691 factory path.
A useful next API experiment needs the actual SCPL admission/authentication and
DtvSvc contract for a named read operation. Exact-build and physical-board
applicability still need evidence before proposing generated output for the TV.
A tested native execution path and recovery procedure remain required before
persistent installation. The approved retro interface remains the candidate
Home UI for that work. A later [owner photo](evidence/tv-check-owner-photo-2026-11-06.json)
records basic TV Check rendering and script/key receipts. The optional Local API
result and full guide workflow remain separate pending observations.
