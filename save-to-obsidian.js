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

const titleCase = (() => {
  const stopwords = "a an and at but by for in nor of on or so the to up yet";
  const defaults = stopwords.split(" ");

  const capitalize = function (str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return function (str, options) {
    const opts = options || {};

    if (!str) return "";

    const stop = opts.stopwords || defaults;
    const keep = opts.keepSpaces;
    const splitter = /(\s+|[-‑–—])/;

    return str
      .split(splitter)
      .map((word, index, all) => {
        if (word.match(/\s+/)) return keep ? word : " ";
        if (word.match(splitter)) return word;

        if (
          index !== 0 &&
            index !== all.length - 1 &&
            stop.includes(word.toLowerCase())
        ) {
          return word.toLowerCase();
        }

        return capitalize(word);
      })
      .join("");
  };
})();

function safeFileName(title) {
  return title
    .replaceAll(":", "")
    .replace(/[/\\?%*|"<>]/g, "-")
    .replace(/[ \.\-]+$/, "");
}

function formatAuthorInTitle(creators) {
  if (creators.length === 1) {
    return creators[0].lastName;
  }
  return `${creators[0].lastName} et al.`;
}

function formatAuthorInMetadata(creators) {
  return (
    "[[" +
    creators
      .map((e) => safeFileName(`${e.firstName} ${e.lastName}`.trim()))
      .join("]], [[") +
    "]]"
  );
}

function formatTags(tags) {
  return "#" + tags.map((t) => t.tag).join(" #");
}

async function formatNote(fileName, item) {
  const key = item.getField("key");
  const citationKey = item.getField("citationKey");
  const title = item.getField("title");
  const creators = item.getCreators();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const created = `${year}-${month}-${day}`;
  const category = item.itemType === "book" ? "book" : "article";

  const lines = [
    "---",
    `aliases: [${citationKey}]`,
    "---",
    `# ${fileName}\n`,
    "## Metadata\n",
    "**Source**:: #from/zotero",
    "**Zettel**:: #zettel/fleeting",
    "**Status**:: #x",
    `**Authors**:: ${formatAuthorInMetadata(creators)}`,
    `**Full Title**:: ${title}`,
    `**Category**:: #${category}`,
    `**Date**:: [[${item.getField("date")}]]`,
    `**Created**:: [[${created}]]`,
    `**Document Tags**:: ${formatTags(item.getTags())}`,
  ];

  let url = item.getField("url");
  if (url !== null && url !== undefined && url !== "") {
    const domain = url.split("://", 2)[1].split("/", 2)[0];
    lines.push(`**URL**:: [${domain}](${url})`);
  }

  lines.push(
    `**Zotero App Link**:: [Open in Zotero](zotero://select/library/items/${key})`,
  );
  lines.push(
    `**Zotero Web Link**:: [zotero.org](https://www.zotero.org/${ZOTERO_USERNAME}/items/${key})`,
  );

  const abstract = item.getField("abstractNote")?.trim() || "";
  if (abstract !== "") {
    lines.push("\n## Abstract\n");
    lines.push(abstract);
  }

  return lines.join("\n");
}

function getBaseDirectory() {
  let rootDir = Zotero.Prefs.get("extensions.zotero.baseAttachmentPath", true);
  // Ensure the baseDir ends with a path separator
  if (!rootDir.endsWith(PATH_SEPARATOR)) {
    rootDir += PATH_SEPARATOR;
  }
  rootDir += ["Brain", "robot", "Zotero Library"].join(PATH_SEPARATOR);
  return rootDir;
}

async function save(item) {
  const title = titleCase(item.getField("title"));
  const fileName = [
    formatAuthorInTitle(item.getCreators()),
    safeFileName(title),
  ].join(" - ");
  const noteContent = await formatNote(fileName, item);
  const path = [getBaseDirectory(), fileName + ".md"].join(PATH_SEPARATOR);
  const newFile = Zotero.File.pathToFile(path);
  if (newFile.exists()) {
    log(`${path} exists, skip`);
    return;
  }

  await Zotero.File.putContentsAsync(newFile, noteContent);
  await Zotero.Attachments.linkFromFile({
    file: newFile,
    parentItemID: item.id,
    libraryID: item.libraryID,
  });
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
