// Name: Convert Stored Files to Linked Files
// Event: None
// Operation: Script
// Menu Label: Convert Stored Files to Linked Files
// Menu:
// - In Collection Menu
const Zotero = require("Zotero");
const PATH_SEPARATOR = Zotero.isWin ? "\\" : "/";
const INVALID_PATH_RE = /[\\/:*?"<>|]/g;

function log(message) {
  Zotero.debug(message);
}

async function exportCollection(collection, baseDir) {
  const childItems = await Zotero.Items.getAsync(
    collection.getChildItems(true),
  );
  await Promise.all(
    childItems.map(async (childItem) => {
      await exportItem(childItem, baseDir);
    }),
  );

  const childCollections = await Zotero.Collections.getAsync(
    collection.getChildCollections(true, false),
  );
  await Promise.all(
    childCollections.map(async (childCollection) => {
      const childBaseDir =
        baseDir + PATH_SEPARATOR + sanitizeCollectionName(childCollection.name);
      await exportCollection(childCollection, childBaseDir);
    }),
  );
}

async function exportItem(item, baseDir) {
  if (item.isLinkedFileAttachment()) {
    return;
  }
  if (item.isAttachment()) {
    await exportAttachment(item, baseDir);
  } else if (item.isRegularItem()) {
    const childItems = await Zotero.Items.getAsync(item.getAttachments());
    await Promise.all(
      childItems.map(async (childItem) => {
        await exportItem(childItem, baseDir);
      }),
    );
  }
}

async function exportAttachment(item, baseDir) {
  const fileExists = await item.fileExists();
  if (!fileExists) {
    return;
  }

  const file = await item.getFilePathAsync();
  if (!file) {
    return;
  }

  let filename = file.split(PATH_SEPARATOR).pop();
  const fileParts = filename.split(".");
  const baseName = fileParts.slice(0, -1).join(".");
  const extension = fileParts.pop();

  let linkedFilePath = [baseDir, filename].join(PATH_SEPARATOR);

  if (linkedFilePath === file) {
    return;
  }

  let newFile = Zotero.File.pathToFile(linkedFilePath);
  let counter = 1;
  while (newFile.exists()) {
    filename = `${baseName} (${counter}).${extension}`;
    linkedFilePath = [baseDir, filename].join(PATH_SEPARATOR);
    newFile = Zotero.File.pathToFile(linkedFilePath);
    counter++;
  }
  log(`save as linked file: ${linkedFilePath}`);

  const originalFile = Zotero.File.pathToFile(file);
  const parentDir = newFile.parent;
  if (!parentDir.exists()) {
    parentDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
  }

  // Move the file to the new location
  originalFile.moveTo(parentDir, newFile.leafName);

  // Link the file in Zotero
  await Zotero.Attachments.linkFromFile({
    file: newFile,
    parentItemID: item.parentItemID,
    libraryID: item.libraryID,
  });

  await item.eraseTx();
}

function sanitizeCollectionName(name) {
  return name.replace(INVALID_PATH_RE, "");
}

async function getBaseDirectory(collection) {
  let rootDir = Zotero.Prefs.get("extensions.zotero.baseAttachmentPath", true);
  // Ensure the baseDir ends with a path separator
  if (!rootDir.endsWith(PATH_SEPARATOR)) {
    rootDir += PATH_SEPARATOR;
  }
  rootDir += ["Archive", "Archived Papers"].join(PATH_SEPARATOR);

  const path = [sanitizeCollectionName(collection.name)];
  while (collection.parentID !== false) {
    collection = await Zotero.Collections.getAsync(collection.parentID);
    path.push(sanitizeCollectionName(collection.name));
  }
  path.push(rootDir);
  path.reverse();

  return path.join(PATH_SEPARATOR);
}

async function main(collection) {
  const baseDir = await getBaseDirectory(collection);
  await exportCollection(collection, baseDir);
  return "Converted to linked attachments";
}

return await main(collection);
