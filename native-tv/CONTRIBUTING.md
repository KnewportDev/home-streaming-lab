# Contributing

The canonical project is `native-tv/` in [KnewportDev/home-streaming-lab](https://github.com/KnewportDev/home-streaming-lab). Use Node.js 24; the current tools have no third-party runtime dependencies.

## Working loop

1. Make a focused change with a clear user-visible result or a specific compatibility question.
2. Use `node tools/preview-home.cjs` for interface work. Check keyboard focus and remote-style navigation alongside the visual design.
3. Run `node --check home/home.js` and the existing offline tests:

   ```sh
   node --test tools/test-inspect-tv.cjs tools/test-native-session.cjs tools/test-usb-diagnostic.cjs
   ```

4. Open a pull request. The scoped workflow runs the checks and produces a preview artifact from an explicit asset allowlist.
5. Explain the concrete problem, the decision made, and the evidence that the change works. Include remaining hardware questions when relevant. Match hardware findings to the tested commit before proposing a release.

Add a regression test when fixing a meaningful failure, particularly around credentials, request boundaries, pairing state, and cross-platform file handling. Tests use synthetic data, mocked transports, loopback servers, and temporary files; they must not require the home network, a real TV, or secrets.

Use [ENGINEERING-NOTES.md](docs/ENGINEERING-NOTES.md) for substantial investigations: symptom, bounded reproduction, diagnosis, fix, and validation. Include commands or a named regression test. Update the README's status when the evidence changes; do not promote a planned milestone into a completed result.

## Hardware findings

Record the exact model, firmware, operation, and observed result. Keep the distinctions between a successful HTTP response, code executing on the TV, a working app launch, and behavior surviving a restart. Findings from another TV or firmware are research leads until reproduced on this target.

Publish concise, redacted findings. Keep raw responses, local addresses, serial numbers, PINs, pairing state, and credentials in `.private/`. Use synthetic fixtures in tests. Personal `home/config.json` is ignored; shared defaults belong in `home/config.example.json`.

## Changes to protocol and runtime behavior

Prefer primary project code, official developer materials, and direct observations. Link the evidence in the change description. Preserve the GET-only boundary of the inspection tool and the explicit model/firmware checks in the session tool. Keep root, flash, bootloader, and persistence experiments separate from ordinary preview or pairing commands.

The hosted workflow runs offline checks and packages a static browser preview. It uses the shared example configuration, never a personal configuration or credential file. TV verification and future releases follow those checks; hardware installation needs a separately observed result. Cite a specific completed run when reporting hosted CI status.

Contributions to original project code remain under the [MIT license](LICENSE). Retain attribution for upstream material and describe external contributions accurately.
