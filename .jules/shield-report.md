# Shield Report

## NPM Audit

```
# npm audit report

react-router  7.0.0 - 7.12.0-pre.0
Severity: high
React Router has CSRF issue in Action/Server Action Request Processing - https://github.com/advisories/GHSA-h5cw-625j-3rxh
React Router vulnerable to XSS via Open Redirects - https://github.com/advisories/GHSA-2w69-qvjg-hvjx
React Router SSR XSS in ScrollRestoration - https://github.com/advisories/GHSA-8v8x-cx79-35w7
fix available via `npm audit fix --force`
Will install react-router@7.15.1, which is outside the stated dependency range
node_modules/react-router

undici  7.0.0 - 7.23.0
Severity: high
Undici has an unbounded decompression chain in HTTP responses on Node.js Fetch API via Content-Encoding leads to resource exhaustion - https://github.com/advisories/GHSA-g9mf-h72j-4rw9
Undici: Malicious WebSocket 64-bit length overflows parser and crashes the client - https://github.com/advisories/GHSA-f269-vfmq-vjvj
Undici has an HTTP Request/Response Smuggling issue - https://github.com/advisories/GHSA-2mjp-6q6p-2qxm
Undici has Unbounded Memory Consumption in WebSocket permessage-deflate Decompression - https://github.com/advisories/GHSA-vrm6-8vpv-qv8q
Undici has Unhandled Exception in WebSocket Client Due to Invalid server_max_window_bits Validation - https://github.com/advisories/GHSA-v9p9-hfj2-hcw8
Undici has CRLF Injection in undici via `upgrade` option - https://github.com/advisories/GHSA-4992-7rv2-5pvq
fix available via `npm audit fix --force`
Will install wrangler@4.93.0, which is outside the stated dependency range
node_modules/miniflare/node_modules/undici
  miniflare  <=0.0.0-fff677e35 || >=3.20250204.0
  Depends on vulnerable versions of undici
  Depends on vulnerable versions of ws
  node_modules/miniflare
    wrangler  <=0.0.0-31bfd374c || 4.0.0 - 4.59.2
    Depends on vulnerable versions of miniflare
    node_modules/wrangler


ws  8.0.0 - 8.20.0
Severity: moderate
ws: Uninitialized memory disclosure - https://github.com/advisories/GHSA-58qx-3vcg-4xpx
fix available via `npm audit fix --force`
Will install wrangler@4.93.0, which is outside the stated dependency range
node_modules/ws

5 vulnerabilities (2 moderate, 3 high)

To address all issues, run:
  npm audit fix --force

```

## Secrets Scan

```


? Name of Subreddit to watch: reddit.com/r/[43D[43C
```
