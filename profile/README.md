# Dylan Cornett
### Windows troubleshooting · PowerShell · Networking

I’m building practical IT skills through a home lab: diagnosing Windows problems, writing small tools, and documenting what the evidence actually shows.

My current work lives in [Home Media Lab](https://github.com/KnewportDev/home-streaming-lab), with two distinct projects: a native TV interface and a PC-to-TV streaming setup.

## Selected work

| Project | What to look at |
| --- | --- |
| **[Vizio Native](https://github.com/KnewportDev/home-streaming-lab/tree/main/native-tv)** | Dependency-free Node.js tools for bounded LAN discovery, device inspection, and PIN-pairing state; a local HTML/CSS/JavaScript interface; offline regression tests. |
| **[Windows streaming lab](https://github.com/KnewportDev/home-streaming-lab/blob/main/docs/STREAMING-LAB.md)** | PowerShell host checks and CSV reporting, input validation, and a documented configuration repair with before-and-after evidence. |

## Start with the evidence

- **Windows troubleshooting:** [a three-byte configuration repair](https://github.com/KnewportDev/home-streaming-lab/blob/main/docs/TROUBLESHOOTING-UTF8-BOM.md) — compare the bytes with the application log, preserve a backup, and verify the result after restart.
- **Node.js tooling:** [a Windows pairing-state write failure](https://github.com/KnewportDev/home-streaming-lab/blob/main/native-tv/docs/ENGINEERING-NOTES.md#windows-pairing-state-write-failure) — isolate the failure and protect the fix with regression coverage.
- **PowerShell:** [reporting and validation checks](https://github.com/KnewportDev/home-streaming-lab/blob/main/tests/Run-Tests.ps1) — distinguish sample data from measurements and reject invalid input.
- **Networking:** [bounded discovery code](https://github.com/KnewportDev/home-streaming-lab/blob/main/native-tv/tools/inspect-tv.cjs) — private-address validation, limited requests, and redacted output.

**Verification matters.** The TV interface has a local preview and offline tests. On-TV execution and persistent installation remain unverified in the published baseline. The streaming lab also has a separate, pending end-to-end TV test.

**How this work is developed:** I use AI assistance for code, troubleshooting, and documentation. These repositories record the implementation, checks, and remaining gaps; they are not a claim that every step was completed independently.

[LinkedIn](https://www.linkedin.com/in/dylan-cornett-958556184/) · [Project hub](https://github.com/KnewportDev/home-streaming-lab)
