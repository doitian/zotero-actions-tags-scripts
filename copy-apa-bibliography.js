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

const styleID = "http://www.zotero.org/styles/apa";
const style = Zotero.Styles.get(styleID);

if (!style) {
    return "Style not found. Make sure APA 7th is installed.";
}

const citeProc = style.getCiteProc();
citeProc.setOutputFormat("text"); // Or use "html"
citeProc.updateItems(items.map(item => item.id));

// makeBibliography() returns an array: [ formatting_settings, [ array_of_entries ] ]
const bibliography = citeProc.makeBibliography();

if (bibliography) {
	const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
    clipboard.addText(bibliography[1].join(""), "text/unicode");
	clipboard.copy();
	return `APA copied`;
} else {
    return "Could not generate bibliography.";
}
