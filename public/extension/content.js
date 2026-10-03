/**
 * Baseera Chrome Extension Content Script
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get_selection') {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    let context = '';
    if (selection && selection.anchorNode && selection.anchorNode.parentElement) {
      context = selection.anchorNode.parentElement.innerText.slice(0, 300);
    }
    sendResponse({ text, context });
  }
});
