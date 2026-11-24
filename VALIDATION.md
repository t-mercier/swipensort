# Validation

Checks performed on the local-import implementation using synthetic contacts only.

## Automated checks

- 20 engine tests: explainable matching, conflicts, international-phone defaults, indexed/exhaustive equivalence, safe vCard basics, a 100,000-candidate guard, and linear spelling comparison for very long names.
- 15 parser/export tests: vCard 3.0 and 4.0, folding, escaping, parameters, structured names, original property roundtrip, photos, grouped labels, extras, successive merges, size limits and explicit rejection of unsupported encodings or ambiguous advanced references.
- 22 Chromium workflow checks: local import, merge, preview, selected-field export, originals, undo, failed-import atomicity, no persistent storage or remote resource loads, offline export, session clearing, and layouts at 320, 478 and 1,440 pixels.
- A delayed file-read check verified that Escape cannot close the import dialog while it is applying an import; the cancel button is disabled until reading completes.
- A source review checked contact-derived HTML escaping, absence of contact uploads, and lossless handling of extra properties. Two findings (pending-import cancellation and quadratic long-name spelling comparisons) were fixed and rechecked.

The exact generated HTML was served through the browser test harness. File-URL navigation is blocked in that harness; the app itself has no module imports, adjacent-file dependencies or network requests.

## Limits

No personal address book was read or used for these checks. Safari, Firefox, physical touch devices and roundtrip imports into Apple Contacts or Google Contacts have not been verified. Test a small copy of your own export before replacing an address book.

Direct Google/iCloud account connections and provider writeback are not implemented in this revision. Google configuration and provider integration are separate follow-up work; the current application uses local vCard files.

Publication uses an explicit source-file allowlist, with no local contact files, personal screenshots, credentials, logs or environment files. The bundled font license notices are retained.
