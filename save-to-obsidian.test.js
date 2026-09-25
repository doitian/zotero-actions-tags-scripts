import { afterAll, expect, test } from "bun:test";

const source = await Bun.file(
  new URL("save-to-obsidian.js", import.meta.url),
).text();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const samples = [];

class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [2024, 1, 29, 12, 30]));
  }
}

function makeItem({
  fields = {},
  creators,
  tags = [],
  attachments = [],
  regular = true,
  itemType = "book",
} = {}) {
  const values = {
    key: "ABC123",
    citationKey: "axler2020LinearAlgebra",
    date: "2020-05",
    title: "Linear Algebra Done Right",
    ...fields,
  };
  return {
    id: 42,
    libraryID: 1,
    itemType,
    getField: (key) => values[key] ?? "",
    getCreators: () =>
      creators ?? [{ firstName: "Sheldon", lastName: "Axler" }],
    getTags: () => tags.map((tag) => ({ tag })),
    getAttachments: () => attachments,
    isRegularItem: () => regular,
    addedTags: [],
    saves: 0,
    addTag(tag) {
      this.addedTags.push(tag);
    },
    async saveTx() {
      this.saves++;
    },
  };
}

function attachment(title, url, mode = 3) {
  return { attachmentLinkMode: mode, getField: (key) => ({ title, url })[key] };
}

async function load({
  attachments = [],
  exists = false,
  isWin = true,
  root,
  expose = true,
  items = [{}],
  item = null,
} = {}) {
  const calls = {
    writes: [],
    links: [],
    logs: [],
    attachmentReads: 0,
    titles: [],
  };
  const Zotero = {
    isWin,
    debug: (message) => calls.logs.push(message),
    Items: {
      async getAsync() {
        calls.attachmentReads++;
        return attachments;
      },
    },
    Attachments: {
      LINK_MODE_LINKED_URL: 3,
      async linkFromFile(options) {
        calls.links.push(options);
      },
    },
    Prefs: { get: () => root ?? (isWin ? "C:\\Library" : "/library/") },
    Utilities: {
      capitalizeTitle(title, force) {
        calls.titles.push({ title, force });
        return title;
      },
    },
    File: {
      pathToFile: (path) => ({ path, exists: () => exists }),
      async putContentsAsync(file, content) {
        calls.writes.push({ path: file.path, content });
      },
    },
  };
  const code = expose
    ? source.replace(
        /^return await main\(items\);$/m,
        "return { formatNote, save, main };",
      )
    : source;
  const api = await new AsyncFunction("require", "items", "item", "Date", code)(
    (name) => {
      expect(name).toBe("Zotero");
      return Zotero;
    },
    items,
    item,
    FixedDate,
  );
  return { api, calls };
}

function parse(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  expect(match).not.toBeNull();
  return {
    yaml: match[1],
    properties: Bun.YAML.parse(match[1]),
    body: content.slice(match[0].length),
  };
}

async function render(item, options = {}, title = item.getField("title")) {
  const { api } = await load(options);
  const result = parse(await api.formatNote("Test note", title, item));
  samples.push(result);
  return result;
}

test("all book metadata is frontmatter; body keeps title and abstract", async () => {
  const item = makeItem({
    fields: {
      url: "https://linear.axler.net/",
      DOI: "10.123/example",
      publisher: "Example Publisher",
      abstractNote: "  An abstract.\n\nSecond paragraph.  ",
    },
    tags: ["math", "open-access", "math"],
  });
  const { properties, body } = await render(item);
  expect(properties).toEqual({
    aliases: ["@axler2020LinearAlgebra"],
    authors: ["[[Sheldon Axler]]"],
    "full-title": "Linear Algebra Done Right",
    date: "[[2020-05]]",
    created: "[[2024-02-29]]",
    status: "x",
    zettel: "fleeting",
    url: "https://linear.axler.net/",
    doi: "https://doi.org/10.123/example",
    publisher: "[[Example Publisher]]",
    "zotero-app-link": "zotero://select/library/items/ABC123",
    "zotero-web-link": "https://www.zotero.org/ianyi/items/ABC123",
    tags: ["from/zotero", "book", "math", "open-access"],
  });
  expect(body).toBe(
    "# Test note\n\n## Abstract\n\nAn abstract.\n\nSecond paragraph.",
  );
  expect(body).not.toContain("## Metadata");
});

test("multiple authors, corporate authors, and article publication fallback", async () => {
  const { properties } = await render(
    makeItem({
      itemType: "journalArticle",
      fields: { publicationTitle: "Journal: Research" },
      creators: [
        { firstName: "Alice", lastName: "Smith" },
        { lastName: "研究会" },
      ],
    }),
  );
  expect(properties.authors).toEqual(["[[Alice Smith]]", "[[研究会]]"]);
  expect(properties.publisher).toBe("[[Journal: Research]]");
  expect(properties.tags).toContain("article");
  expect(properties).not.toHaveProperty("category");
  expect(properties).not.toHaveProperty("kind");
});

test("missing metadata uses null/empty lists without fabricated links", async () => {
  const { properties, body } = await render(
    makeItem({ creators: [], fields: { date: "", citationKey: "" } }),
  );
  expect(properties.authors).toBeNull();
  expect(properties.date).toBeNull();
  expect(properties.aliases).toEqual([]);
  expect(properties).not.toHaveProperty("document-tags");
  expect(properties.status).toBe("x");
  expect(properties.zettel).toBe("fleeting");
  expect(properties.tags).toEqual(["from/zotero", "book"]);
  for (const key of ["url", "doi", "publisher"])
    expect(properties).not.toHaveProperty(key);
  expect(body).toBe("# Test note\n");
});

for (const text of [
  "Quotes: \"double\" and 'single'",
  "Line 1\nLine 2\n",
  "\r\n\t\0\b\f\u001f\u0085\u2028\u2029",
  "中文 📚 🦊",
  "C:\\path\\to\\book",
  "true",
  "2026-09-24",
  "#tag: [value] {other}",
]) {
  test(`safe YAML strings ${JSON.stringify(text)}`, async () => {
    const { properties } = await render(
      makeItem({
        fields: { citationKey: text, url: "https://example.org/?q=" + text },
      }),
      {},
      text,
    );
    expect(properties["full-title"]).toBe(text);
    expect(properties.aliases).toEqual(["@" + text]);
    expect(properties.url).toBe("https://example.org/?q=" + text);
  });
}

test("web attachments use kebab keys without altering URLs or punctuation", async () => {
  const pairs = [
    [" Code: [Archive] ", 'https://example.org/code?q="quoted"', "code:-[archive]"],
    ["__proto__", "https://example.org/proto", "-proto-"],
    ["constructor", "custom://item/42", "constructor"],
    ["Mirror\n\u2028中文", "https://example.org/mirror", "mirror-中文"],
  ];
  const { properties } = await render(
    makeItem({ attachments: [1, 2, 3, 4, 5] }),
    {
      attachments: [
        ...pairs.map(([title, url]) => attachment(title, url)),
        attachment("File", "file:///test.pdf", 2),
        attachment("", "https://example.org"),
        attachment("Empty", ""),
      ],
    },
  );
  for (const [, url, key] of pairs) expect(properties[key]).toBe(url);
  expect(properties).not.toHaveProperty("file");
  expect(properties).not.toHaveProperty("empty");
});

test("repeated attachment titles merge case-insensitively without dropping URLs", async () => {
  const { properties } = await render(makeItem({ attachments: [1, 2, 3] }), {
    attachments: [
      attachment("Mirror", "https://example.org/1"),
      attachment("mirror", "https://example.org/2"),
      attachment("MIRROR", "https://example.org/1"),
    ],
  });
  expect(properties.mirror).toEqual([
    "https://example.org/1",
    "https://example.org/2",
    "https://example.org/1",
  ]);
  expect(properties).not.toHaveProperty("Mirror");
});

test("document tags retain meaning and order without becoming enums", async () => {
  const { properties } = await render(makeItem({
    tags: ["app", "later", "zettel/permanent", "x", "x", "MixedCase", "mixedcase"],
  }));
  expect(properties.tags).toEqual(["from/zotero", "book", "app", "later", "zettel/permanent", "x", "MixedCase", "mixedcase"]);
  expect(properties.status).toBe("x");
  expect(properties.zettel).toBe("fleeting");
  expect(properties).not.toHaveProperty("kind");
});

test("acronyms, camel case, underscores and dollar markers stay distinct", async () => {
  const titles = ["APIReference", "libraryID", "Code_URL", "$itemKey", "itemKey"];
  const { properties } = await render(makeItem({ attachments: titles.map((_, i) => i) }), {
    attachments: titles.map((title, i) => attachment(title, "https://example.org/" + i)),
  });
  for (const [i, key] of ["api-reference", "library-id", "code-url", "$item-key", "item-key"].entries()) {
    expect(properties[key]).toBe("https://example.org/" + i);
  }
});

test("case-insensitive duplicates retain the first title's word boundaries", async () => {
  const { properties } = await render(makeItem({ attachments: [1, 2, 3] }), {
    attachments: ["CodeURL", "CODEURL", "codeurl"].map((title, i) => attachment(title, "https://example.org/" + i)),
  });
  expect(properties["code-url"]).toEqual(["https://example.org/0", "https://example.org/1", "https://example.org/2"]);
  expect(properties).not.toHaveProperty("codeurl");
});

for (const titles of [["Code URL", "code-url"], ["CodeURL", "Code_URL"], ["APIReference", "API Reference"]]) {
  test(`reject normalization collision ${titles.join(" / ")} before writing`, async () => {
    const item = makeItem({ attachments: [1, 2] });
    const { api, calls } = await load({
      attachments: titles.map((title, i) => attachment(title, "https://example.org/" + i)),
    });
    await expect(api.save(item)).rejects.toThrow("normalize to the same property");
    expect(calls.writes).toEqual([]);
    expect(calls.links).toEqual([]);
    expect(item.addedTags).toEqual([]);
    expect(item.saves).toBe(0);
  });
}

for (const name of [
  "aliases",
  "TAGS",
  "Authors",
  "Date",
  "Full Title",
  "URL",
  "DOI",
  "Publisher",
  "Source",
  "Zettel",
  "Category",
  "Status",
  "Created",
  "Document Tags",
  "Zotero App Link",
  "full-title",
  "fullTitle",
  "Full_Title",
  "zotero-app-link",
  "ZoteroWebLink",
  "document-tags",
  "documentTags",
  "kind",
]) {
  test(`reject reserved attachment property ${name} without side effects`, async () => {
    const item = makeItem({ attachments: [1] });
    const { api, calls } = await load({
      attachments: [attachment(name, "https://example.org/conflict")],
    });
    await expect(api.save(item)).rejects.toThrow("conflicts with metadata");
    expect(calls.writes).toEqual([]);
    expect(calls.links).toEqual([]);
    expect(item.addedTags).toEqual([]);
    expect(item.saves).toBe(0);
  });
}

for (const isWin of [false, true]) {
  test(`save keeps filename and integration behavior (${isWin ? "Windows" : "POSIX"})`, async () => {
    const item = makeItem();
    const { api, calls } = await load({ isWin });
    await api.save(item);
    const prefix = isWin
      ? "C:\\Library\\Brain\\robot\\Zotero Library\\"
      : "/library/Brain/robot/Zotero Library/";
    expect(calls.writes[0].path).toBe(
      prefix + "Axler - Linear Algebra Done Right.md",
    );
    expect(calls.links).toHaveLength(1);
    expect(calls.links[0].parentItemID).toBe(42);
    expect(calls.links[0].libraryID).toBe(1);
    expect(item.addedTags).toEqual(["to/obsidian"]);
    expect(item.saves).toBe(1);
    expect(calls.titles).toEqual([
      { title: "Linear Algebra Done Right", force: true },
    ]);
  });
}

test("authorless items use the title as filename", async () => {
  const { api, calls } = await load();
  await api.save(makeItem({ creators: [] }));
  expect(calls.writes[0].path.endsWith("\\Linear Algebra Done Right.md")).toBe(
    true,
  );
});

test("existing files skip metadata processing, writing, linking, and tags", async () => {
  const item = makeItem({ attachments: [1] });
  const { api, calls } = await load({
    exists: true,
    attachments: [attachment("aliases", "https://example.org/conflict")],
  });
  await api.save(item);
  expect(calls.attachmentReads).toBe(0);
  expect(calls.writes).toEqual([]);
  expect(calls.links).toEqual([]);
  expect(item.addedTags).toEqual([]);
  expect(item.saves).toBe(0);
  expect(calls.logs[0]).toContain("exists, skip");
});

test("action guards and non-regular-item filtering remain intact", async () => {
  expect((await load({ expose: false, items: [] })).api).toBeUndefined();
  expect((await load({ expose: false, item: {} })).api).toBeUndefined();
  const regular = makeItem();
  const skipped = makeItem({ regular: false });
  const { api, calls } = await load();
  expect(await api.main([regular, skipped])).toBe("Saved 1 notes");
  expect(calls.writes).toHaveLength(1);
  expect(skipped.saves).toBe(0);
});

afterAll(async () => {
  if (process.env.ZOTERO_TEST_SAMPLES) {
    await Bun.write(
      process.env.ZOTERO_TEST_SAMPLES,
      JSON.stringify(samples, null, 2) + "\n",
    );
  }
});
