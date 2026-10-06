/**
 * Baseera Chrome Extension — Background Service Worker (Manifest V3)
 * يدير قوائم السياق (Context Menus) للنصوص والصور
 * ويعمل كجسر وسيط (Network Proxy) لتفادي قيود CSP و Mixed Content على المواقع المشددة (مثل Google و Facebook)
 */

const DEFAULT_API_BASE = 'https://baseera.onrender.com';

async function getApiBase() {
  try {
    const res = await chrome.storage.local.get('baseera_api_base');
    return res.baseera_api_base || DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  // 1. Context menu for selected text
  chrome.contextMenus.create({
    id: 'baseera_verify_selection',
    title: '🔎 تحقّق عبر بصيرة',
    contexts: ['selection']
  });

  // 2. Context menu for images
  chrome.contextMenus.create({
    id: 'baseera_verify_image',
    title: '🔎 تحقّق من الصورة عبر بصيرة',
    contexts: ['image']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === 'baseera_verify_selection') {
    sendMessageToTab(tab.id, {
      action: 'baseera_verify_selection',
      text: info.selectionText
    });
  } else if (info.menuItemId === 'baseera_verify_image') {
    sendMessageToTab(tab.id, {
      action: 'baseera_verify_image',
      srcUrl: info.srcUrl
    });
  }
});

// Network Proxy Listener: content script calls background to bypass host page CSP & Mixed Content
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'api_lookup') {
    getApiBase().then((apiBase) => {
      fetch(`${apiBase}/api/extension-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: request.text, context: request.context || '' })
      })
        .then(async (res) => {
          const data = await res.json();
          sendResponse({ success: res.ok, data });
        })
        .catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'api_lookup_image') {
    getApiBase().then((apiBase) => {
      fetch(`${apiBase}/api/extension-lookup-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: request.imageUrl,
          imageBase64: request.imageBase64
        })
      })
        .then(async (res) => {
          const data = await res.json();
          sendResponse({ success: res.ok, data });
        })
        .catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
    });
    return true;
  }
});

function sendMessageToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) {
      // Content script might not be injected yet into this tab, inject it and retry
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      }, () => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, message);
        }, 150);
      });
    }
  });
}
