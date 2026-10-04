/**
 * Baseera Chrome Extension Popup Script — Fast & Dynamic Verification
 */

const API_BASE = 'http://localhost:3000';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function verifySelection(text, context) {
  if (!text || !text.trim()) return;

  const loading = document.getElementById('loading');
  const verdictContainer = document.getElementById('verdict-container');
  const canonicalContainer = document.getElementById('canonical-container');
  const actionContainer = document.getElementById('action-container');
  const toggleBtn = document.getElementById('toggle-details-btn');
  const detailsContainer = document.getElementById('details-container');

  loading.style.display = 'block';
  verdictContainer.innerHTML = '';
  canonicalContainer.innerHTML = '';
  actionContainer.innerHTML = '';
  toggleBtn.style.display = 'none';
  detailsContainer.style.display = 'none';
  detailsContainer.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE}/api/extension-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context })
    });
    const data = await res.json();
    loading.style.display = 'none';

    if (data.report) {
      const rep = data.report;
      let cardClass = 'verdict-matched';
      let icon = '✓ ';
      if (rep.status === 'NEEDS_REVIEW') {
        cardClass = 'verdict-review';
        icon = '⚠️ ';
      } else if (rep.status === 'NOT_FOUND_IN_CHECKED_SOURCES') {
        cardClass = 'verdict-notfound';
        icon = '↗ ';
      }

      const label = rep.status_label_ar || rep.status;
      const hasEmoji = /^[✓⚠️⛔❓✅📖]/.test(label);
      const displayHeading = hasEmoji ? label : `${icon}${label}`;

      // Direct Verdict Box
      verdictContainer.innerHTML = `
        <div class="verdict-card ${cardClass}">
          <div class="verdict-title">${escapeHtml(displayHeading)}</div>
          ${rep.citation ? `
            <div class="verdict-source">
              <strong>المصدر:</strong> ${escapeHtml(rep.citation.source_name)}
              ${rep.citation.book ? ` · ${escapeHtml(rep.citation.book)}` : ''}
              ${rep.citation.grade ? ` · الدرجة: ${escapeHtml(rep.citation.grade)}` : ''}
            </div>
          ` : ''}
        </div>
      `;

      // Canonical / Ruling Text
      const mainText = rep.canonical_text || rep.reason;
      if (mainText) {
        canonicalContainer.innerHTML = `
          <div class="canonical-box">
            <div style="font-size:10px; color:#34d399; font-weight:bold; margin-bottom:4px;">الحكم / النص المعتمد في المرجع:</div>
            <div style="font-size:12px; line-height:1.6;">${escapeHtml(mainText)}</div>
          </div>
        `;
      }

      // One-Click Action Link
      if (rep.citation && rep.citation.url) {
        actionContainer.innerHTML = `
          <a href="${encodeURI(rep.citation.url)}" target="_blank" class="btn-verify">
            <span>فتح السند في الدرر السنية</span>
            <span>↗</span>
          </a>
        `;
      }

      // Expandable Details
      let detailsHtml = '';
      if (rep.reason && rep.canonical_text) {
        detailsHtml += `<p style="margin:0 0 6px 0;"><strong>التفصيل:</strong> ${escapeHtml(rep.reason)}</p>`;
      }
      if (rep.reduction_warning) {
        detailsHtml += `<p style="margin:0; color:#fbbf24;"><strong>تنبيه سياقي:</strong> ${escapeHtml(rep.reduction_warning)}</p>`;
      }
      if (detailsHtml) {
        detailsContainer.innerHTML = detailsHtml;
        toggleBtn.style.display = 'block';
        toggleBtn.onclick = () => {
          const isOpen = detailsContainer.style.display === 'block';
          detailsContainer.style.display = isOpen ? 'none' : 'block';
          toggleBtn.innerText = isOpen ? '▼ عرض تفاصيل إضافية' : '▲ إخفاء التفاصيل';
        };
      }
    } else {
      verdictContainer.innerHTML = `
        <div class="verdict-card verdict-notfound">
          <div class="verdict-title">↗ لم يُعثر عليه في المراجع المفحوصة</div>
          <div class="verdict-source">لم يُعثر على هذا اللفظ كحديث أو آية أو مسألة في النطاق المعتمد المفحوص.</div>
        </div>
      `;
    }
  } catch (err) {
    loading.style.display = 'none';
    verdictContainer.innerHTML = `
      <div class="verdict-card verdict-review">
        <div class="verdict-title">تعذر الاتصال بمحرك بصيرة</div>
        <div class="verdict-source">يرجى التأكد من تشغيل السيرفر المحلي (http://localhost:3000).</div>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const manualInput = document.getElementById('manual-input');
  const manualBtn = document.getElementById('manual-btn');
  const selectionBox = document.getElementById('selection-box');
  const selectedTextEl = document.getElementById('selected-text');

  manualBtn?.addEventListener('click', () => {
    const text = manualInput.value.trim();
    if (text) {
      selectedTextEl.innerText = text;
      selectionBox.style.display = 'block';
      verifySelection(text, '');
    }
  });

  manualInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') manualBtn?.click();
  });

  // Query active tab text
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;

      // First try executing script directly in active tab to get actual live selection
      try {
        if (chrome.scripting && chrome.scripting.executeScript) {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString().trim()
          });
          const text = results?.[0]?.result?.trim();
          if (text && text.length >= 2) {
            selectedTextEl.innerText = text;
            selectionBox.style.display = 'block';
            verifySelection(text, '');
            return;
          }
        }
      } catch (err) {
        // Fallback to sendMessage if executeScript fails on restricted tabs
      }

      // Fallback: try sendMessage to content script
      chrome.tabs.sendMessage(tab.id, { action: 'get_selection' }, (response) => {
        if (chrome.runtime?.lastError) {
          // Content script not loaded yet — leave manual input ready
          return;
        }
        if (response && response.text) {
          selectedTextEl.innerText = response.text;
          selectionBox.style.display = 'block';
          verifySelection(response.text, response.context || '');
        }
      });
    });
  }
});
