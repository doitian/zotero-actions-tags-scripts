Scripts for the Zotero plugin [windingwind/zotero-actions-tags](https://github.com/windingwind/zotero-actions-tags)

## Save to Obsidian

`save-to-obsidian.js` exports all note-level metadata as YAML frontmatter. The body contains the note title and abstract. Non-tag field names and citation-key aliases are retained; authors, publisher, and dates use wikilinks, while URL, DOI, and Zotero links store their URI targets. Source, workflow, category, and document tags are stored only in native `tags`, without duplicate Source, Zettel, Status, Category, or Document Tags properties. Tag values and order are retained.

Authors are a list or `null` when absent. Missing dates are `null`, and missing citation keys produce an empty aliases list. Without document tags, native `tags` still includes the source, workflow, and category defaults. Authorless items use the title as their filename. Existing files are skipped before metadata processing and are never rewritten, relinked, or retagged.

Linked-URL attachments become properties named after their trimmed titles. Repeated titles, compared case-insensitively, retain the first spelling and collect all URLs into a list. A title that conflicts with a built-in metadata property or one of the retired tag-property names causes an error before the note is written; give the attachment an unambiguous title rather than overwriting metadata. Quoted YAML keys also support punctuation in attachment titles.

To deploy a script update, replace the code in the existing **Save to Obsidian** action in Zotero Actions & Tags. Updating this repository does not update the installed action or migrate previously exported notes.

### Tests

With Bun installed:

```sh
bun test
```

The tests use a mocked Zotero API and do not modify a real Zotero library or Obsidian vault.
