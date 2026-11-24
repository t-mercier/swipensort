# Swipe n Sort

Keep or discard contacts one card at a time, review duplicates, and choose the fields to retain. Local vCard mode needs no account; Google mode connects directly to Google without an app backend.

## Try it

Open [Swipe n Sort](https://t-mercier.github.io/swipensort/) for Google connection, or download `index.html` for offline vCard imports. Syne, DM Sans and the application code are embedded in that HTML file. Google connection requires the hosted HTTPS app and an Internet connection.

1. Start with **Tri**: swipe left to discard a card, right to keep it. Both decisions can be undone. Explore the synthetic demo or choose **Importer un .vcf**.
2. Select one or more UTF-8 vCard 3.0 or 4.0 exports. Import replaces the current session; demo contacts are never mixed into your address book.
3. Choose a country only if national phone numbers in the files belong to that country. Otherwise leave the country unknown.
4. Switch to **Doublons** to review the matching reasons and select the fields to retain. Equivalent national and international phone formats default to the international version. Other variants remain available.
5. Review the final card and merge explicitly. Incompatible names or different birth dates require additional confirmation; coordinate differences are shown without an extra checkbox.
6. Export the current address book or the original cards as a `.vcf` copy. Keep your initial export as a backup before importing the result into a contacts service.

On mobile, **Tri** fills the screen with a three-card stack, bottom actions and navigation. Details and import/export options open separately. In **Tri**, drag the contact card left to discard it or right to keep it. Short fast flicks and longer diagonal gestures are supported; slow short gestures snap back without a decision, and mobile Tri stays fixed to the viewport. Buttons and arrow keys provide the same actions. In **Doublons**, the separate comparison handle keeps cards separate on the left and opens the merge preview on the right. You can also discard one or both duplicate cards without merging them. Swiping never merges cards automatically. Original files remain intact; vCard export contains the remaining cards.

## Privacy

Imported files are read only in the current browser tab. The app has no app-backend upload, analytics, external AI, remote fonts or persistent contact storage. Google connection loads the official Google authorization library only when requested and exchanges data directly with Google. Reloading, closing the page, or choosing **Effacer de l’onglet** discards the session. Export your result before leaving.

The HTML restricts network access to the Google authorization and People API endpoints through its content security policy. Images and URLs from imported cards are preserved as data; the app does not load them. Imported contact values are escaped before display. Browser extensions and the browser itself are outside the app's control.

This repository contains source code and explicitly synthetic examples only. Do not commit address books, personal exports, screenshots of personal contacts, credentials or private test fixtures. `.gitignore` excludes common contact/export paths, and `npm run audit:public` checks the publication allowlist and common secret patterns. These checks do not replace reviewing files before publication.

## Google connection (testing)

Choose **Connecter Google**, select a country only if applicable, and authorize read access on Google's screen. Prepare keep/discard/merge decisions locally. No provider write occurs until you choose **Appliquer dans Google**, review the named affected records and counts, explicitly confirm, and grant the separate contacts-write permission. Discarding a contact in Tri queues an explicit deletion; missing records alone never imply deletion.

The app uses the public browser OAuth client ID in `src/config.js`. It contains no client secret, password or access token. The client is restricted to the hosted origin. OAuth is currently in Google's Testing status; only configured test accounts can connect. Public production verification has not been completed. iCloud direct account connection is not implemented; iCloud/Mac exports use the local-file flow.

Tokens and contacts stay in tab memory. The complete original Google API records can be downloaded as a local `.contacts.json` backup. That backup is not an automatic restore mechanism. Disconnecting clears the session token and requests revocation of the active grant.

Applying Google changes checks account identity and contact versions, updates each keeper, verifies the selected fields in Google's response, then removes its absorbed duplicates. Standalone deletions require explicit local decisions and are version-checked too. Writes are sequential and are never automatically retried. Failures or uncertain responses stop processing and require reloading the account; remote changes already completed cannot be undone with the local Undo button. Google offers no documented conditional version parameter on deletion, so the final pre-delete read cannot eliminate the entire concurrent-edit window. Avoid editing the same address book elsewhere during application.

The adapter reloads records at the list API's 100-email/phone cap before building previews, preserves all selected organization roles, and blocks merges that would silently lose non-transferable photos, cover photos or skills. Only fields exposed by Google's supported API are covered. Real-account writes have not been exercised by the automated checks; all mutation tests use synthetic mocks. Read [privacy.html](privacy.html) before connecting.

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
