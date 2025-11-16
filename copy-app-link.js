// Name: Copy App Link
// Event: None
// Operation: Script
// Menu Label: Copy App Link
// Menu:
// - In Item Menu
// - In Collection Menu
// - In Annotation Menu

// @author windingwind, garth74
// @link https://github.com/windingwind/zotero-actions-tags/discussions/115
// @usage Select an item in the library and press the assigned shortcut keys
// @update Mon, 22 Jan 2024 00:10:18 GMT (by new Date().toGMTString())

// EDIT THESE SETTINGS

/** @type {string} Name of the field to use as the link text. To use the citation key, set this to "citationKey". */
let linkTextField = "title";

/** @type {'html' | 'md' | 'plain'} What type of link to create. */
let linkType = "plain";

/** @type {boolean} If true, make the link specific to the currently selected collection. */
let useColl = false;

/** @type {boolean} If true, use Better Notes zotero://note link when the selected item is a note. */
let useNoteLink = false;

/** @type {'select' | 'open-pdf' | 'auto'} Action of link*/
let linkAction = "auto"; // auto = open-pdf for PDFs and annotations, select for everything else

// END OF EDITABLE SETTINGS

// For efficiency, only execute once for all selected items
if (item) return;
item = items[0];
if (!item && !collection) return "[Copy Zotero Link] item is empty";

if (collection) {
  linkAction = "select";
  useColl = true;
}

if (linkAction === "auto") {
  if (item.isPDFAttachment() || item.isAnnotation()) {
    linkAction = "open-pdf";
  } else {
    linkAction = "select";
  }
}

const uriParts = [];
let uriParams = "";

let targetItem = item;
if (linkAction === "open-pdf") {
  uriParts.push("zotero://open-pdf");
  if (item.isRegularItem()) {
    targetItem = (await item.getBestAttachments()).find((att) =>
      att.isPDFAttachment(),
    );
  } else if (item.isAnnotation()) {
    targetItem = item.parentItem;
    // If the item is an annotation, we want to open the PDF at the page of the annotation
    let pageIndex = 1;
    try {
      pageIndex = JSON.parse(item.annotationPosition).pageIndex + 1;
    } catch (e) {
      Zotero.warn(e);
    }
    uriParams = `?page=${pageIndex}&annotation=${item.key}`;
  }
} else {
  uriParts.push("zotero://select");
  if (item?.isAnnotation()) {
    targetItem = item.parentItem;
  }
}

if (!targetItem && !collection) return "[Copy Zotero Link] item is invalid";

// Get the link text using the `link_text_field` argument
let linkText;
if (collection) {
  // When `collection` is truthy, this script was triggered in the collection menu.
  // Use collection name if this is a collection link
  linkText = collection.name;
} else if (item.isAttachment()) {
  // Try to use top-level item for link text
  linkText = Zotero.Items.getTopLevel([item])[0].getField(linkTextField);
} else if (item.isAnnotation()) {
  // Add the annotation text to the link text
  linkText = `${targetItem.getField(linkTextField)}(${
    item.annotationComment || item.annotationText || "annotation"
  })`;
} else {
  // Use the item's field
  linkText = item.getField(linkTextField);
}

// Add the library or group URI part (collection must go first)
let libraryType = (collection || item).library.libraryType;
if (libraryType === "user") {
  uriParts.push("library");
} else {
  uriParts.push(
    `groups/${Zotero.Libraries.get((collection || item).libraryID).groupID}`,
  );
}

// If useColl, make the link collection specific
if (useColl) {
  // see https://forums.zotero.org/discussion/73893/zotero-select-for-collections
  let coll = collection || Zotero.getActiveZoteroPane().getSelectedCollection();

  // It's possible that a collection isn't selected. When that's the case,
  // this will fall back to the typical library behavior.

  // If a collection is selected, add the collections URI part
  if (!!coll) uriParts.push(`collections/${coll.key}`);
}

if (!collection) {
  // Add the item URI part
  uriParts.push(`items/${targetItem.key}`);
}

// Join the parts together
let uri = uriParts.join("/");

// Add the URI parameters
if (uriParams) {
  uri += uriParams;
}

if (useNoteLink && item?.isNote() && Zotero.BetterNotes) {
  uri = Zotero.BetterNotes.api.convert.note2link(item);
}

// Format the link and copy it to the clipboard
const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
if (linkType == "html") {
  clipboard.addText(`<a href="${uri}">${linkText}</a>`, "text/unicode");
} else if (linkType == "md") {
  clipboard.addText(`[${linkText}](${uri})`, "text/unicode");
} else {
  clipboard.addText(uri, "text/unicode");
}

clipboard.addText(`<a href="${uri}">${linkText}</a>`, "text/html");

clipboard.copy();

return `[Copy Zotero Link] link ${uri} copied.`;
