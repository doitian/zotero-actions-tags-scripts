// Name: Save to Obsidian
// Event: None
// Operation: Script
// Menu Label: Save to Obsidian
// Menu:
// - In Item Menu
if (items?.length === 0 || item !== null) {
  return;
}

const Zotero = require("Zotero");
const ZOTERO_USERNAME = "ianyi";
const PATH_SEPARATOR = Zotero.isWin ? "\\" : "/";

function log(message) {
  Zotero.debug(`[Save to Obsidian] ${message}`);
}

function safeFileName(title) {
  return title
    .replaceAll(":", "")
    .replace(/[/\\?%*|"<>]/g, "-")
    .replace(/[ \.\-]+$/, "");
}

function formatAuthorInTitle(creators) {
  if (creators.length === 0) {
    return "";
  }
  if (creators.length === 1) {
    return creators[0].lastName;
  }
  return `${creators[0].lastName} et al.`;
}

function formatAuthorInMetadata(creators) {
  const authors = creators
    .map((creator) =>
      safeFileName(
        [creator.firstName, creator.lastName].filter(Boolean).join(" ").trim(),
      ),
    )
    .filter(Boolean)
    .map((name) => `[[${name}]]`);
  return authors.length ? authors : null;
}

function propertyKey(name) {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function yamlValue(value) {
  return JSON.stringify(value)
    .replaceAll("\u0085", "\\u0085")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function formatMetadata(properties) {
  return Array.from(properties, ([key, value]) => {
    if (Array.isArray(value) && value.length) {
      return `${yamlValue(key)}:\n${value.map((entry) => `  - ${yamlValue(entry)}`).join("\n")}`;
    }
    return `${yamlValue(key)}: ${yamlValue(value)}`;
  }).join("\n");
}

async function webLinkProperties(item) {
  const attachmentIDs = item.getAttachments();
  if (!attachmentIDs?.length) {
    return [];
  }
  const attachments = await Zotero.Items.getAsync(attachmentIDs);
  return attachments
    .filter(
      (attachment) =>
        attachment.attachmentLinkMode ===
        Zotero.Attachments.LINK_MODE_LINKED_URL,
    )
    .map((attachment) => [
      attachment.getField("title")?.trim(),
      attachment.getField("url"),
    ])
    .filter(([title, url]) => title && url);
}

async function formatNote(fileName, title, item) {
  const key = item.getField("key");
  const citationKey = item.getField("citationKey");
  const creators = item.getCreators();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const created = `${year}-${month}-${day}`;
  const category = item.itemType === "book" ? "book" : "article";
  const date = item.getField("date");
  const tags = item
    .getTags()
    .map((tag) => tag.tag)
    .filter(Boolean);
  const properties = new Map([
    ["aliases", citationKey ? [`@${citationKey}`] : []],
    ["authors", formatAuthorInMetadata(creators)],
    ["full-title", title],
    ["date", date ? `[[${date}]]` : null],
    ["created", `[[${created}]]`],
  ]);

  const url = item.getField("url");
  if (url) {
    properties.set("url", url);
  }
  const doi = item.getField("DOI");
  if (doi !== null && doi !== undefined && doi !== "") {
    properties.set("doi", `https://doi.org/${doi}`);
  }
  const publisher =
    item.getField("publisher") || item.getField("publicationTitle");
  if (publisher !== null && publisher !== undefined && publisher !== "") {
    properties.set("publisher", `[[${publisher}]]`);
  }
  properties.set("zotero-app-link", `zotero://select/library/items/${key}`);
  properties.set(
    "zotero-web-link",
    `https://www.zotero.org/${ZOTERO_USERNAME}/items/${key}`,
  );
  properties.set(
    "tags",
    Array.from(new Set(["x", "zettel/fleeting", "from/zotero", category, ...tags])),
  );

  const reserved = new Set([
    ...Array.from(properties.keys(), (name) => name.toLowerCase()),
    "url",
    "doi",
    "publisher",
    "source",
    "kind",
    "status",
    "zettel",
    "category",
    "document-tags",
  ]);
  const attachmentNames = new Map();
  for (const [name, link] of await webLinkProperties(item)) {
    const normalized = propertyKey(name);
    if (reserved.has(normalized)) {
      throw new Error(
        `Web-link attachment property conflicts with metadata: ${name}`,
      );
    }
    const identity = name.toLowerCase();
    const firstName = attachmentNames.get(identity);
    if (firstName !== undefined) {
      const current = properties.get(firstName);
      properties.set(firstName, [
        ...(Array.isArray(current) ? current : [current]),
        link,
      ]);
    } else {
      if (properties.has(normalized)) {
        throw new Error(
          `Web-link attachment titles normalize to the same property: ${name}`,
        );
      }
      attachmentNames.set(identity, normalized);
      properties.set(normalized, link);
    }
  }

  const lines = ["---", formatMetadata(properties), "---", `# ${fileName}\n`];
  const abstract = item.getField("abstractNote")?.trim() || "";
  if (abstract !== "") {
    lines.push("## Abstract\n");
    lines.push(abstract);
  }

  return lines.join("\n");
}

function getBaseDirectory() {
  let rootDir = Zotero.Prefs.get("extensions.zotero.baseAttachmentPath", true);
  // Ensure the `rootDir` ends with a path separator
  if (!rootDir.endsWith(PATH_SEPARATOR)) {
    rootDir += PATH_SEPARATOR;
  }
  rootDir += ["Brain", "robot", "Zotero Library"].join(PATH_SEPARATOR);
  return rootDir;
}

async function save(item) {
  const title = Zotero.Utilities.capitalizeTitle(item.getField("title"), true);
  const fileName = [
    formatAuthorInTitle(item.getCreators()),
    safeFileName(title),
  ]
    .filter(Boolean)
    .join(" - ");
  const path = [getBaseDirectory(), fileName + ".md"].join(PATH_SEPARATOR);
  const newFile = Zotero.File.pathToFile(path);
  if (newFile.exists()) {
    log(`${path} exists, skip`);
    return;
  }

  const noteContent = await formatNote(fileName, title, item);
  await Zotero.File.putContentsAsync(newFile, noteContent);
  await Zotero.Attachments.linkFromFile({
    file: newFile,
    parentItemID: item.id,
    libraryID: item.libraryID,
  });
  item.addTag("to/obsidian");
  await item.saveTx();
}

async function main(items) {
  let count = 0;
  for (const item of items) {
    if (item.isRegularItem()) {
      await save(item);
      count += 1;
    }
  }
  return `Saved ${count} notes`;
}

return await main(items);
