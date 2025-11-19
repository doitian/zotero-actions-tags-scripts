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
citeProc.setOutputFormat("html");
citeProc.updateItems(items.map(item => item.id));

// makeBibliography() returns an array: [ formatting_settings, [ array_of_entries ] ]
const bibliography = citeProc.makeBibliography();

if (!bibliography) {
    return "Could not generate bibliography.";
}

const markdownEntries = bibliography[1].map(function(entry) {
    let md = entry;

    // Remove the outer div wrapper (Zotero standard wrapper)
    md = md.replace(/<div[^>]*>/g, "").replace(/<\/div>/g, "");

    // Convert Italics: <i>...</i> to *...*
    md = md.replace(/<i>/g, "*").replace(/<\/i>/g, "*");

    // Convert Bold: <b>...</b> to **...** (just in case)
    md = md.replace(/<b>/g, "**").replace(/<\/b>/g, "**");

    // Remove the "nocase" spans we added, but keep the text inside
    md = md.replace(/<span class="nocase">/g, "").replace(/<\/span>/g, "");

    // Convert Links: <a href="...">...</a> to [text](url)
    // Note: APA usually just prints the URL text, but if there is an anchor tag:
    md = md.replace(/<a href="([^"]+)">([^<]+)<\/a>/g, function(match, href, text) {
        if (href === text) {
            return "<" + href + ">";
        } else {
            return "[" + text + "](" + href + ")";
        }
    });

    // Clean up HTML entities
    md = md.replace(/&(amp|#38);/g, "&")
        .replace(/&(lt|#60);/g, "<")
        .replace(/&(gt|#62);/g, ">")
        .replace(/&nbsp;/g, " ");

    // Trim extra whitespace
    return md.trim();
});

const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
if (markdownEntries.length == 1) {
	clipboard.addText(markdownEntries[0], "text/unicode");
} else {
    clipboard.addText("-   " + markdownEntries.join("\n-   "), "text/unicode");
}
clipboard.copy();
return `APA copied`;
