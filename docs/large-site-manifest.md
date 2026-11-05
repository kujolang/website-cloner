# Large-site editable export manifest

[Documentation index](README.md)

The global `content-layout.json` previously duplicated every record's full
presentation bindings and its slot decorations. Large migrations could therefore
hit V8's single-string limit while serializing the manifest, even though their
capture checkpoints already used streaming JSON.

The builder now keeps presentation bindings only in `templates/data/*.json`.
The manifest retains authored metadata, the sidecar path, slot names, and a
SHA-256 fingerprint of the full original metadata. The export runtime compares
one record at a time using that fingerprint to detect edits for archive updates.
It retains the previous comparison path for older exports without fingerprints.

This reduces aggregate memory and serialization size without dropping classes,
attributes, component bindings, Markdown decorations, or edit detection. It does
not change the content-template grouping algorithm or claim that all sites fit
one universal template set.

See [semantic templates](semantic-templates.md) for current role-template reuse.

## Verification

The regression fixture creates 40 pages with large presentation attributes and
asserts that the manifest stays below 100 KB, the complete attributes remain in
sidecars, and reconstructed metadata matches its saved fingerprint. Tests also
check key-order independence and changes to bindings, metadata and array order.
Portable export integration tests cover unchanged archives, edited Markdown,
changed titles, taxonomy relationships, new/deleted routes, drafts and pagination.
