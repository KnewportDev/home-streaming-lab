# Matching source release

The published VIZIO catalog maps firmware `1.720.X.Y` to chipset **5691** and
release **FUR7.2**. That matches the family reported by this V405-H9:
`1.720.9.1-1`, ViziOS `mtk5691-1.6.1770.1`. It does not establish that the archive
reproduces this exact build or contains a usable retail installer.

The [source README](https://github.com/opensource-vizio/5691_FUR7.2_OpenSourceSoftware/blob/1d05e3cb76d453a8d6a76f38dd2b8409b428bb11/README.md)
and [checksums](https://github.com/opensource-vizio/5691_FUR7.2_OpenSourceSoftware/blob/1d05e3cb76d453a8d6a76f38dd2b8409b428bb11/checksums)
are pinned to commit `1d05e3cb76d453a8d6a76f38dd2b8409b428bb11`.
The [catalog mapping](https://github.com/opensource-vizio/.github/blob/fed538e319826066d7e96cdf92bd385f139d24d9/profile/README.md)
is pinned separately. The [initial family record](evidence/source-family-5691-fur72.json)
preserves the earlier discovery state. The later [acquisition receipt](evidence/source-archive-2026-11-06.json)
and [direct inspection](SOURCE-INSPECTION.md) record the completed download and
selected source review without changing that history.

## Get the archive

The README links to the [download form for 5691_OSS_FUR7.2.zip](https://d2mi77xcznxniv.cloudfront.net/index.html?file=5691_OSS_FUR7.2.zip).
The form requires name, email, phone, and company and describes compliance,
audit, and download tracking. The owner approved the submission, and the normal
publisher flow completed on **6 November 2026**. The downloaded ZIP measured
**7,946,973,901 bytes** and matched both pinned published digests. Its SHA-256 is
`974b76513f493e24494dcb2edce67add04795be4f6f60e07b95961131fe456bf`.

The ZIP and selected extracted source are saved in the ignored
`native-tv/.private/source-inbox/` directory on the development PC. Contact
details, registration identifiers, signed URLs, the archive, and vendor files
stay out of this MIT-licensed repository. Only redacted evidence and original
analysis are published. Other copies should also use sufficient local storage
and a trusted directory.

## Verify without executing

From `native-tv/`, using Node.js 24, after saving the ZIP:

```powershell
$sourceInbox = Join-Path (Get-Location).Path '.private/source-inbox'
New-Item -ItemType Directory -Force $sourceInbox | Out-Null
$sourceArchive = Join-Path $sourceInbox '5691_OSS_FUR7.2.zip'
$sourceReport = Join-Path $sourceInbox 'source-check.json'
node tools/verify-source-bundle.cjs --archive "$sourceArchive" --out "$sourceReport"
```

The archive and optional output arguments must be absolute paths. The output
file must not exist; omit `--out` to print only the JSON. The tool does not
download, unpack, compile, execute source, or contact the TV. It reads through
a fixed 1 MiB buffer, accepts at most 32 GiB, calculates MD5, SHA-1, and SHA-256,
and compares both published digests:

| Digest | Pinned publisher value |
| --- | --- |
| MD5 | `5b62eb08af859ee6cd49e654c45c76b1` |
| SHA-1 | `38c0a3e5cefd2eafa9acdad074ed88cea90c7b63` |

Exit **0** means both published digests match. Exit **2** means a stable file
was read but the digests differ; the rejected report is still available.
Exit **1** means invalid arguments, a refused path, a changed file, or an I/O
failure. Neither a filename nor matching digests proves exact-build
compatibility, signature authority, recovery, or installation eligibility.
The report leaves those last two compatibility/installation fields
`unverified`. SHA-256 is calculated for subsequent local comparisons; the
pinned publisher file supplies no SHA-256 value.

The JSON includes public source references, byte count, hashes, and the digest
decision. It omits local paths and personal identity. The verifier refuses
existing output files, symbolic links/junctions, and detected file or parent
replacement. Use trusted local directories: portable Node path checks cannot
guarantee protection from an actively malicious transient directory swap or
prove that a mapped drive is physically local. Reading may update access time;
the archive contents are never written. A checksum match is not a digital
signature or an audit of the source.

## Source inspection record

An [independent owner's inspection record](https://github.com/zerckzzyHD/Appliances/blob/40a7dc754ba14811d589a0925a56109a7669da72/TV-Workbench/docs/history/import-2026-10-23/forge/FIRMWARE-RESEARCH.md)
reported ViziOS platform services and an OSUpdater in this release and supplied
the initial leads. Selected files from our own verified publisher download have
now been inspected. [The findings](SOURCE-INSPECTION.md) identify the actual
members, hashes, controller behavior, updater checks, and unresolved boundaries.

| Source area | Current review |
| --- | --- |
| `feature-manager/src/main.cpp` | HomePage configuration updates the orchestrator registry; creating a temporary node is not persistence proof. |
| `platform_orchestrator/src/appsdatabase.cpp` and controller implementations | Home alias/URI resolution, fallback ordering, and different Loki/browser behavior are traced. The retail TV's effective controller remains unobserved. |
| `OSUpdater/osu/src/manifest/impl/manifest_parser.cpp` | The parser records a manifest signature; parsing alone does not validate it. |
| `OSUpdater/osu/src/asset_installers/impl/sc_assets_installer.cpp`, config installer, and manager callers | Install/post-install precede aggregate status and path switching; web/config synchronization is called at manager startup. Runtime behavior and full failure recovery remain unverified. |
| `OSUpdater/unpacker/src/unpacker.cpp` and verification helpers | Selected asset download validation reaches OpenSSL SHA-256 signature verification. This does not establish a way to install unsigned owner content. |
| `build_gpl_fw.sh` and `mt5691_cast/Makefile` | The ViziOS script selects `mtk5695`; the separate MT5691 board target selects `m7632`. Exact output compatibility remains unresolved. |

Inspection used archive listings and bounded reads of selected regular text
files after digest verification. No vendor program was executed. Component
license notices remain attached to the private source. Source inspection can explain
architecture; it does not grant shell access, signing keys, a writable Home
configuration, or a recovery procedure on the retail TV. The milestones in
[NATIVE-SYSTEM.md](NATIVE-SYSTEM.md) remain open.
