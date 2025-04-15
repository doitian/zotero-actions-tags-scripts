// Name: Copy Web Link
// Event: None
// Operation: Script
// Menu Label: Copy Web Link
// Menu:
// - In Item Menu
// - In Collection Menu

const userID = "ianyi";

if (!item && !collection) return "[Copy Zotero Link] item is empty";

const key = (collection || item).key;
const kind = collection ? "collections" : "items";
const uri = `https://www.zotero.org/${userID}/${kind}/${key}`;

// Use clipboard helper to copy plain text (URI)
const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
clipboard.addText(uri, "text/unicode");
clipboard.copy();

return `[Copy Zotero Link] link ${uri} copied.`;
