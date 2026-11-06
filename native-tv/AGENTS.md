# Vizio Native project guidance

## Canonical source and goal

The source of record is `KnewportDev/home-streaming-lab`, under `native-tv/`. This is a continuing personal IT and networking homelab whose target is the VIZIO television itself booting into an owned retro interface and, if a compatible hardware port and boot method are established, an owned native system. The current implementation is a browser interface and control tooling; it is not a replacement operating system. Keep changes focused on this goal and explain the concrete problem each change solves.

The observed target is V405-H9, system firmware `1.720.9.1-1`, ViziOS build `mtk5691-1.6.1770.1`. Older H19 notes do not override live identity. Consult the current README for verification status before describing something as installed or compatible.

The user has explicitly deferred running the PC continuously as a media or channel server. The onn is allowed for everyday streaming, but is not a substitute for the native-TV goal. Keep the public guide on GitHub Pages for review and preserve the approved Suddenlink-style design in the native package. Personal scheduled channels are a future phase. Track native-system evidence in `docs/NATIVE-SYSTEM.md` and issue #1. Root, a backup/recovery path, native execution, persistent Home behavior, and full firmware replacement are separate milestones.

## Interface direction

Use the user's latest direction: a 2000s Suddenlink-style cable guide, informed by classic i-Guide. Use contiguous blue program cells, a yellow selection, silver time headers, channel numbers, program details, and a bordered preview pane. Keep the project branding original. Sample listings must remain clearly labeled and never imply connected channels, live playback, or a real electronic program feed. Keep the result usable from a couch with a directional remote. Focus movement, readable contrast, large targets, and a working Back path take priority over decorative effects.

Keep assets local and avoid external fonts, analytics, or advertising. Preserve compatibility with the TV browser when changing JavaScript or CSS; inspect the existing implementation before introducing newer syntax or APIs.

## Development and evidence

- Use Node.js 24 and keep the tools dependency-free unless a concrete need warrants a change.
- Keep inspection bounded and GET-only. Retain exact model/firmware checks before native session actions.
- Keep local preview, temporary TV execution, native app control, and persistent installation as distinct verification states.
- A passing test, accepted launch request, or PC screenshot does not prove a TV installation. Report what was actually observed.
- Use primary sources for protocol changes. Never assume an exploit or installation procedure for another model applies here.
- Add meaningful regressions for actual failures, including Windows state-file behavior. Tests must use synthetic data and must not contact a TV.
- Record substantial debugging in `docs/ENGINEERING-NOTES.md` with the failure, evidence, decision, and reproducible checks.
- Keep portfolio language factual and readable. Do not invent ownership, independence, performance numbers, completed milestones, green hosted runs, or compatibility results. Update test counts when changing the suite.

## Local data

Credentials, pairing state, PINs, raw device responses, and personal configuration remain local and ignored. Use `.private/` for device state and captures, and `home/config.json` for personal configuration. Never put those values in source, screenshots, issues, logs, CI, or commit messages. Shared examples use placeholder addresses and synthetic values.

The repository workflow checks code and packages a static preview from an explicit asset allowlist. Successful main-branch builds publish that same public preview to GitHub Pages. Preserve the branch, checks, preview artifact, TV verification, and future release progression. CI does not launch software on or monitor the TV. Keep MIT attribution and upstream reference links intact.

Use focused branches and pull requests for continuing work. CI checks Linux and Windows Node behavior, packages an allowlisted native-interface preparation bundle with a content manifest, and publishes only the browser preview after a successful main-branch build. Preparation artifacts are not installers, firmware images, or proof of native compatibility.
