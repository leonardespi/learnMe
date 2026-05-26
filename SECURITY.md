# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Scope

learnMe is a local desktop application. It makes **zero network calls** at runtime — no data leaves your machine. The attack surface is limited to:

- Local SQLite database file
- `.learnme` session files you import from disk
- The Tauri/WebView runtime

## Reporting a vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.

Send a private report to: **touchmelenny@gmail.com**

Include:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Any suggested fix (optional)

You will receive an acknowledgement within 72 hours. If confirmed, a patch release will be issued and you will be credited in the release notes (unless you prefer to remain anonymous).

## Out of scope

- Vulnerabilities in `npm` or `cargo` dependencies unrelated to learnMe's own code — report those to the respective upstream projects.
- Attacks that require physical access to the user's machine and full read access to their filesystem.
- Social engineering.
