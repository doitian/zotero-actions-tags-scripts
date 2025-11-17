// Name: Save to Raindrop
// Event: None
// Operation: Script
// Menu Label: Save to Raindrop
// Menu:
// - In Item Menu
if (items?.length === 0 || item !== null) {
  return;
}

const ZOTERO_USERNAME = "ianyi";
const RAINDROP_COLLECTION_ID = 54400238;
const RAINDROP_TOKEN = "";

const Zotero = require("Zotero");
function log(message) {
  Zotero.debug(`[Save to Raindrop] ${message}`);
}

function formatAuthor(creators) {
  return creators.map((e) => `${e.firstName} ${e.lastName}`.trim()).join(" & ");
}

async function save(item) {
  let note = `[Open in Zotero](https://www.zotero.org/${ZOTERO_USERNAME}/items/${item.getField("key")})`;
  const abstract = item.getField("abstractNote")?.trim() || "";
  if (abstract !== "") {
    note += "\n\n" + abstract;
  }

  const excerpt = [];
  const date = item.getField("date")?.trim() || "";
  if (date !== "") {
    excerpt.push(date.split("-")[0]);
  }
  excerpt.push(formatAuthor(item.getCreators()));
  const tags = ["from/zotero"];
  tags.push(item.itemType === "book" ? "book" : "article");
  for (const tag of item.getTags()) {
    tags.push(tag.tag);
  }

  const bookmark = {
    title: item.getField("title"),
    excerpt: excerpt.join(", "),
    note: note,
    link: item.getField("url"),
    tags: tags,
    collection: {
      $id: RAINDROP_COLLECTION_ID,
    },
  };

  const jsonData = JSON.stringify(bookmark);
  const response = await fetch("https://api.raindrop.io/rest/v1/raindrop", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RAINDROP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: jsonData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}

async function main(items) {
  let count = 0;
  for (const item of items) {
    let url = item.getField("url");
    if (url !== null && url !== undefined && url !== "") {
      log(`save ${url}`);
      await save(item);
      count += 1;
    }
  }
  return `Saved ${count} bookmarks`;
}

return await main(items);
