// Name: Copy APA
// Event: None
// Operation: Script
// Menu Label: Copy APA
// Menu:
// - In Item Menu
if (items?.length === 0 || item !== null) {
  return;
}

const Zotero = require("Zotero");
const ZoteroPane = require("ZoteroPane");

const pref = "export.quickCopy.setting";
const origSetting = Zotero.Prefs.get(pref);

/**
 * Replace this line with your own setting
 * Steps:
 * 1. Change Settings -> Export -> Quick Copy -> Item Format
 * 2. Open Settings -> Advanced -> Config Editor
 * 3. Search for `export.quickCopy.setting`.
 * 4. Paste the value and replace the string `bibliography/html=http://www.zotero.org/styles/acm-siggraph` below.
 * 5. Reset Settings -> Export -> Quick Copy -> Item Format (If necessary)
 */
const newSetting = "bibliography=http://www.zotero.org/styles/apa";

Zotero.Prefs.set(pref, newSetting);
ZoteroPane.copySelectedItemsToClipboard(false);
Zotero.Prefs.set(pref, origSetting);
return `QuickCopy done`;
