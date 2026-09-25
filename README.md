Scripts for the Zotero plugin [windingwind/zotero-actions-tags](https://github.com/windingwind/zotero-actions-tags)

## Save to Obsidian

`save-to-obsidian.js` exports note-level metadata as YAML frontmatter with lower kebab-case keys, including `full-title`, `zotero-app-link`, and `zotero-web-link`. The body retains the note title and abstract. Citation-key aliases are unchanged; authors, publisher, and dates use wikilinks, while URL, DOI, and Zotero links store their URI targets. Zotero API names such as `libraryID` are not note-property names and remain unchanged.

`status: x` and `zettel: fleeting` are single plain strings, replacing the exporter-generated classification tags. Source, category, and document tags remain in native `tags`. Document tags retain their values and order rather than being reinterpreted as enums; the item category does not imply a `kind`. Authors are a list or `null` when absent. Missing dates are `null`, and missing citation keys produce an empty aliases list. Authorless items use the title as their filename. Existing files are skipped before metadata processing and are never rewritten, relinked, or retagged.

Linked-URL attachment titles become kebab-case property names: camel/acronym word boundaries, spaces, and underscores become dashes. Punctuation and markers such as `$` are retained, and keys are YAML-quoted. Case-insensitive repeated titles use the first title's word boundaries and collect every URL into a list. Distinct titles that normalize to the same key are rejected before writing, as are aliases of generated metadata keys, reserved enum names, and retired tag-property names. Give conflicting attachments unambiguous titles rather than overwriting or silently merging metadata.

To deploy a script update, replace the code in the existing **Save to Obsidian** action in Zotero Actions & Tags. Updating this repository does not update the installed action or migrate previously exported notes.

### Tests

With Bun installed:

```sh
bun test
```

The tests use a mocked Zotero API and do not modify a real Zotero library or Obsidian vault.
