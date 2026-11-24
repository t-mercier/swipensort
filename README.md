# Swipe n Sort

Review duplicate contacts locally, choose which fields to keep, and export a copy of your address book. No account or backend is required.

## Try it

Download `index.html` and open it in a recent browser. The application, Syne and DM Sans fonts are embedded in that file; it works offline.

1. Explore the synthetic demo, or choose **Importer un .vcf**.
2. Select one or more UTF-8 vCard 3.0 or 4.0 exports. Import replaces the current session; demo contacts are never mixed into your address book.
3. Choose a country only if national phone numbers in the files belong to that country. Otherwise leave the country unknown.
4. Review the matching reasons and select the fields to retain. Equivalent national and international phone formats default to the international version. Other variants remain available.
5. Review the final card and merge explicitly. Incompatible names or different birth dates require additional confirmation; coordinate differences are shown without an extra checkbox.
6. Export the current address book or the original cards as a `.vcf` copy. Keep your initial export as a backup before importing the result into a contacts service.

The visible swipe handle works with a mouse or touch: left keeps cards separate, right shows the preview. Arrow keys provide the same actions. Swiping never merges cards automatically. Decisions can be undone.

## Privacy

Imported files are read only in the current browser tab. The app has no upload, analytics, external AI, remote fonts, account connection or persistent contact storage. Reloading, closing the page, or choosing **Effacer de l’onglet** discards the session. Export your result before leaving.

The HTML restricts network access through its content security policy. Images and URLs from imported cards are preserved as data; the app does not load them. Imported contact values are escaped before display. Browser extensions and the browser itself are outside the app's control.

This repository contains source code and explicitly synthetic examples only. Do not commit address books, personal exports, screenshots of personal contacts, credentials or private test fixtures. `.gitignore` excludes common contact/export paths, and `npm run audit:public` checks the publication allowlist and common secret patterns. These checks do not replace reviewing files before publication.

## Import and export limits

- Maximum 20 files, 20 MiB and 10,000 cards per import. Invalid input leaves the current session intact.
- vCard 3.0/4.0 UTF-8, folded lines, escaped text, grouped Apple labels and common parameters are supported. vCard 2.1, quoted-printable text and unsupported character encodings are rejected explicitly.
- Original cards retain their properties. Merged cards preserve selected coordinates, structured names, labels and extra fields such as addresses, photos, URLs and custom properties. Extra fields are selectable; media payloads are not displayed or loaded.
- Mixed-version merges and advanced v4 PID/CLIENTPIDMAP/ALTID references are blocked to avoid ambiguous conversion. The original cards can still be exported.
- Exports use CRLF and UTF-8-safe 75-byte line folding. Export/re-import into Apple Contacts, Google Contacts and other services still needs testing with the formats you use.

Matching uses local indexes for emails, country-aware phone numbers, reordered/accent-normalized names, a small nickname dictionary, initials and one-letter spelling differences. Confidence labels are heuristics, not identity probabilities. Shared family coordinates and homonyms need human review. National phone normalization covers FR, NL, GB, US, CA, DE, BE, ES and IT; unsupported countries are not guessed.

Highly repetitive data can generate too many candidate pairs. The app stops at 100,000 candidates and asks for a smaller import instead of silently omitting suggestions. Suggestions and contact lists are shown in batches of 50.

Passwords, Photos and Emails remain future module placeholders. Only Contacts is active.

## Development

Node.js 18 or later is sufficient; there are no runtime or build dependencies.

```sh
npm run build
npm test
npm run audit:public
```

`src/index.template.html` contains the styles and embedded licensed fonts. The build embeds the three JavaScript sources into the standalone `index.html`. Edit the sources, then rebuild.

`tests/browser.scenarios.cjs` exports an asynchronous Playwright scenario accepting a `page`; it uses only synthetic contact files. Serve the repository locally and call it from a Playwright harness. `SWIPE_TEST_URL` overrides its default URL. Browser automation is optional and is not bundled as a dependency.

See [VALIDATION.md](VALIDATION.md) for the checks performed. Font licenses are in `licenses/`. No application license has been selected yet.
