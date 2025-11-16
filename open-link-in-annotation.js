// Name: Open Link in Annotation
// Event: None
// Operation: Script
// Menu Label: Open Link
// Menu:
// - In Annotation Menu
const Zotero = require("Zotero");

function log(message) {
  Zotero.debug(`[Save to Obsidian] ${message}`);
}

function extractFirstURL(text) {
  // Pattern 1: Markdown link format [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
  const markdownMatch = text.match(markdownLinkRegex);
  
  // Pattern 2: Markdown angle bracket format <url>
  const angleBracketRegex = /<([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s>]+)>/;
  const angleBracketMatch = text.match(angleBracketRegex);
  
  // Pattern 3: Plain URL with any protocol
  // Matches protocol://rest-of-url
  const plainURLRegex = /\b([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s<>"\])\}]+)/;
  const plainMatch = text.match(plainURLRegex);
  
  // Collect all matches with their positions
  const matches = [];
  
  if (markdownMatch) {
    matches.push({
      url: markdownMatch[2],
      index: markdownMatch.index
    });
  }
  
  if (angleBracketMatch) {
    matches.push({
      url: angleBracketMatch[1],
      index: angleBracketMatch.index
    });
  }
  
  if (plainMatch) {
    matches.push({
      url: plainMatch[1],
      index: plainMatch.index
    });
  }
  
  // Return the URL that appears first in the text
  if (matches.length === 0) {
    return null;
  }
  
  matches.sort((a, b) => a.index - b.index);
  return matches[0].url;
}

const url = extractFirstURL(item?.annotationComment || "");
if (url) {
	if (url.startsWith("http")) {
		log(`open URL ${url}`);
		Zotero.launchURL(url);
	} else {
		const clipboard = new Zotero.ActionsTags.api.utils.ClipboardHelper();
		clipboard.addText(url);
		clipboard.copy();
		return `[Open Link in Annotation] link ${url} copied, open it in explorer manually`;
	}

}
