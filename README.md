# ElevateResume

Requires Node.js 22 or newer. No dependency installation is needed.

```powershell
node server.cjs
```

Open http://127.0.0.1:3000. Keep the server running. `index (1).html` is the original supplied prototype; the implemented app is `public/index.html` served by `server.cjs`. Original report files were not changed.

The workspace opens on Dashboard with a professional light theme for new sessions. The header switch retains the existing `elevateresume_theme` preference; saved dark preferences use the new neutral dark palette. Dashboard figures come from the current draft and loaded market sample. Printing always uses a separate white resume surface. No data migration is needed.

Enter details, add entries and bullets, and tick each accuracy confirmation. Editing an entry clears its confirmation. Drafts save immediately in this browser under `elevateresume_data_v2`. Confirmed entries alone reach preview, XML and print. Browser storage is local to the URL/browser profile and can be cleared by the browser; export confirmed XML for a portable copy. The original v1 browser draft can be recovered for review from Export Center, if present on this origin. It is never automatically trusted.

XML uses `<resume version="2">`, a `<contact>` object and named section arrays containing `<item>` elements. XML round trips preserve IDs, Unicode, text and confirmations at the serialization layer. The import UI deliberately clears confirmations until you review imported facts. Import is staged, validated, then explicitly replaces the draft. Old versionless prototype XML is not supported. No remote schemas or external XML entities are loaded.

Job matching uses the explicit dictionary in `public/core.js`. It shows recognized mentions and exact confirmed resume evidence. It does not infer mandatory requirements, negation, proficiency, or ATS performance. Quality checks are separate.

## AI setup — pending

No AI provider or model has been selected. There are no canned generation responses. Missing configuration returns HTTP 503 with `AI_SETUP_PENDING`; the UI displays “AI coach unavailable—API setup pending.”

The UI and server contract are implemented. Provider-specific HTTP integration remains pending selection of a provider/model. Credentials must be set **on the server**, for example through a local environment or secret manager; never enter them in the browser, source files or chat. The server does not load `.env` automatically.

After the provider adapter is implemented, these environment variables enable it:

* `AI_PROVIDER`: provider name
* `AI_MODEL`: model ID
* `AI_API_KEY`: server-side credential
* `AI_ADAPTER_MODULE`: absolute path to a trusted CommonJS adapter, outside `public`

Adapter contract: export `async rewrite({provider, model, apiKey, signal, messages})`, perform a real provider request respecting the abort signal, preserve separate system/user messages, and return one plain-text suggestion. Do not flatten job-description data into system instructions or log request bodies/secrets. Return errors by throwing. No adapter or provider SDK is supplied until the provider/model is chosen.

`GET /api/coach/status` returns `{available:false,error}` or `{available:true,provider,model}`.

`POST /api/coach` accepts `{requestId,section,entryId,bulletId,original,revision,confirmedFacts,factsConfirmed:true,jobDescription}`. `section` is `projects` or `experience`. Success returns `{requestId,bulletId,original,revision,suggestion}`. Error codes: 400 invalid request, 403 origin, 413 size, 415 content type, 429 rate limit, 502 provider/validation failure, 503 setup pending.

The request includes only the selected bullet, confirmed facts and optional job text. Instructions require factual preservation, and the server rejects new numbers or dictionary skills. These checks cannot prove semantic factual equivalence; the side-by-side review and explicit fact confirmation are mandatory. Approved text replaces only the selected bullet, never appends new achievements. Source revision and ID checks reject stale suggestions, including edit-and-revert. Errors leave the draft unchanged. Server binds to loopback and is intended for local PBL use, not public hosting.

## Resume signature

In Resume Builder, upload a PNG or JPG signature (up to 5 MB), then select “Include this signature in my resume and exports.” The image is resized locally and appears at the right after the final resume section, including print/Save as PDF. Remove it with “Remove signature.” It stays in browser storage and confirmed XML exports; no upload endpoint is used. Imported signatures require confirmation again. Existing version 2 XML without signatures remains supported. Focused browser checks: `node tests/signature.cjs` (uses the bundled Playwright path on this workspace).

## Market evidence

`public/market-sample.json` bundles 17 unique frontend internship and entry-level frontend/web postings from 17 employer publishers, collected on 9 October 2026 by Codex as an AI-assisted collector. Market Insights loads this dated snapshot automatically and retains manual JSON import. It displays source links, collection dates, known/unknown posting dates, record identities, excerpts and verification notes alongside counts and percentages. It is not live or nationwide representative data. Each dictionary skill counts once per unique posting, including preferred and stack mentions. The small existing dictionary does not count every technology in the excerpts.

`public/market-format.json` remains an unverified format example, never evidence. Repeated IDs or normalized URLs are deduplicated; collectors must use the same ID for syndicated copies. Imported samples replace the display for this session only. Reload bundled sample restores the packaged file, without collecting new records. See [MARKET-DATA.md](MARKET-DATA.md) for provenance, limitations, refresh steps and executed market checks.

## Checks

`node --test tests/core.test.cjs tests/server.test.cjs tests/market.test.cjs` runs focused core, backend and bundled-market checks without dependencies or provider calls (`npm test` is equivalent when npm is available). Browser tests require an existing Playwright installation and Edge: `node tests/browser.cjs` for the full app or `node tests/market-browser.cjs` for market-only checks (set `PLAYWRIGHT_MODULE` to its absolute module directory if it is not locally installed; set `BROWSER_CHANNEL=chrome` to use Chrome instead). See `tests/EXECUTED.md` for the original checks and `MARKET-DATA.md` for the market update. The bundled market tests use the real collected records; original core tests and AI tests retain clearly labelled synthetic fixtures.
