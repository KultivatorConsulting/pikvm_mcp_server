# Security Policy

## Scope

pikvm_mcp_server lets an MCP client control a physical machine through PiKVM. Issues that matter most: authentication or credential handling, TLS verification, unintended input injection, command or prompt injection through screen content, tool or skill definitions that steer agents, and exposure of the PiKVM session.

## Reporting a vulnerability

Please report privately. Do not open a public issue or PR.

1. Preferred: use GitHub's **Report a vulnerability** button under the repository's Security tab (private vulnerability reporting).
2. Alternative: email [security@kultivator.co.nz](mailto:security@kultivator.co.nz).

Include affected version or commit, reproduction steps, and impact. We aim to acknowledge within 5 business days and to give a fix timeline after triage.

## Disclosure

Please allow reasonable time to fix before public disclosure. We'll credit reporters in the release notes unless you prefer otherwise.

## Supported versions

Only the latest commit on `main` is supported.
