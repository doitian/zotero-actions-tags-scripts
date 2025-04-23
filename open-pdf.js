// Name: Open PDF
// Event: None
// Operation: Script
// Menu Label: Open PDF
// Menu:
// - In Item Menu
// - In Reader Menu
/**
 * Open PDFs with the system default
 * @author Y.D.X.
 * @usage Select an item in the Library, then trigger this script.
 * @link https://github.com/windingwind/zotero-actions-tags/discussions/359
 * @see https://github.com/windingwind/zotero-actions-tags/discussions/359
 */

// Modified from zotero-open-pdf.
// https://github.com/retorquere/zotero-open-pdf/blob/b7cd70d04c4dc0791a5f49542552a5231062637d/lib.ts#L198-L204

if (!items?.length) return;

items.forEach(async (item) => {
  const attachment = item.isAttachment()
    ? item
    : await item.getBestAttachment();
  if (attachment?.attachmentPath.toLowerCase().endsWith(".pdf")) {
    Zotero.launchFile(attachment.getFilePath());
  }
});
