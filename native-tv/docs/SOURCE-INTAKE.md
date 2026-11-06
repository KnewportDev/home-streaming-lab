# Matching source release

The published VIZIO catalog maps firmware `1.720.X.Y` to chipset **5691** and
release **FUR7.2**. That matches the family reported by this V405-H9:
`1.720.9.1-1`, ViziOS `mtk5691-1.6.1770.1`. It does not establish that the archive
reproduces this exact build or contains a usable retail installer.

The [source README](https://github.com/opensource-vizio/5691_FUR7.2_OpenSourceSoftware/blob/1d05e3cb76d453a8d6a76f38dd2b8409b428bb11/README.md)
and [checksums](https://github.com/opensource-vizio/5691_FUR7.2_OpenSourceSoftware/blob/1d05e3cb76d453a8d6a76f38dd2b8409b428bb11/checksums)
are pinned to commit `1d05e3cb76d453a8d6a76f38dd2b8409b428bb11`.
The [catalog mapping](https://github.com/opensource-vizio/.github/blob/fed538e319826066d7e96cdf92bd385f139d24d9/profile/README.md)
is pinned separately. The [evidence record](evidence/source-family-5691-fur72.json)
keeps publication, acquisition, inspection, and installation separate.

## Get the archive

The README links to the [download form for 5691_OSS_FUR7.2.zip](https://d2mi77xcznxniv.cloudfront.net/index.html?file=5691_OSS_FUR7.2.zip).
The form requires name, email, phone, and company and describes compliance,
audit, and download tracking. No contact details have been submitted for this
project. The archive has not been acquired or inspected.

If obtaining it, save the downloaded ZIP in the ignored
`native-tv/.private/source-inbox/` directory. Keep contact details, the archive,
and extracted vendor files out of this MIT-licensed repository. Another owner's
inspection reports an archive around 7.9 GB; this project has not measured the
download. Use sufficient local storage and a trusted directory.

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

## Questions for source inspection

An [independent owner's inspection record](https://github.com/zerckzzyHD/Appliances/blob/40a7dc754ba14811d589a0925a56109a7669da72/TV-Workbench/docs/history/import-2026-10-23/forge/FIRMWARE-RESEARCH.md)
reports ViziOS platform services and an OSUpdater in this release. The paths
below are leads from that record, **not files inspected by this project**.

| Reported source area | Question to resolve |
| --- | --- |
| `feature-manager/src/main.cpp` and `doc/features.md` | How namespace 4 and `ChromiumHtmlAppUris` relate to Home/local asset configuration. |
| `platform_orchestrator/src/appsdatabase.cpp` | How Home, error, and onboarding applications are selected. |
| `OSUpdater/osu/src/manifest/impl/manifest_parser.cpp` | How `SC-CONFIG` and `SC-ASSETS` are admitted. |
| `OSUpdater/osu/src/asset_installers/impl/sc_assets_installer.cpp` | How local assets and the active web directory are selected. |
| `OSUpdater/unpacker/src/unpacker.cpp` | What signature checks apply before installation. |

Begin with an archive listing and text inspection after acquisition and digest
verification. Record the actual files, licenses, build instructions, and target
identifiers before relying on reported paths. Source inspection can explain
architecture; it does not grant shell access, signing keys, a writable Home
configuration, or a recovery procedure on the retail TV. The milestones in
[NATIVE-SYSTEM.md](NATIVE-SYSTEM.md) remain open.
