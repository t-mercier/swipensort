# Validation

Checks performed on the contact-triage, local-import and Google implementation using synthetic contacts only.

## Automated checks

- 20 engine tests: explainable matching, conflicts, international-phone defaults, indexed/exhaustive equivalence, safe vCard basics, a 100,000-candidate guard, and linear spelling comparison for very long names.
- 15 parser/export tests: vCard 3.0 and 4.0, folding, escaping, parameters, structured names, original property roundtrip, photos, grouped labels, extras, successive merges, size limits and explicit rejection of unsupported encodings or ambiguous advanced references.
- 22 Chromium local-import workflow checks: local import, merge, preview, selected-field export, originals, undo, failed-import atomicity, no persistent storage or remote resource loads, offline export, session clearing, and layouts at 320, 478 and 1,440 pixels.
- A delayed file-read check verified that Escape cannot close the import dialog while it is applying an import; the cancel button is disabled until reading completes.
- A source review checked contact-derived HTML escaping, absence of contact uploads, and lossless handling of extra properties. Two findings (pending-import cancellation and quadratic long-name spelling comparisons) were fixed and rechecked.

The exact generated HTML was served through the browser test harness. File-URL navigation is blocked in that harness; the app itself has no module imports, adjacent-file dependencies or network requests.

## Limits

No personal address book was read or used for these checks. Safari, Firefox, physical touch devices and roundtrip imports into Apple Contacts or Google Contacts have not been verified. Test a small copy of your own export before replacing an address book.

Google configuration was created with the official Cloud UI: People API enabled, browser client restricted to the hosted app origin, contacts read/write scopes declared, and one test account configured. No client secret was downloaded or published.

32 Google adapter tests and 6 Google authorization tests pass. Combined with the 20 engine and 15 parser tests, this is 73 unit checks. Cases include paginated loading, account mismatch, source-version conflicts, coordinate-cap hydration, organization-role preservation, photo/skill guards, sequential merge/write/delete operations, explicit standalone deletions, incomplete update responses, partial/uncertain failures and no automatic retries.

31 further Chromium checks cover default keep/discard triage, mouse swiping and keyboard, local undo, deleting one or both duplicates, readonly Google connection, local-only queued mutations, explicit write-scope upgrade, mixed merge/deletion batches, failed-preflight write prevention, and mobile layouts. These use synthetic OAuth and People API mocks, not a personal account.

No real Google contacts were read or modified during automated tests. Live Google consent and real-provider mutation behavior still need user testing; OAuth Testing status limits connection to registered test accounts. iCloud direct connection remains unimplemented.

Publication uses an explicit source-file allowlist, with no local contact files, personal screenshots, credentials, logs or environment files. The bundled font license notices are retained.
