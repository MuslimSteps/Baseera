/**
 * Baseera Chrome Extension Popup Script
 */

const API_BASE = window.location.origin || 'http://localhost:3000';

async function verifySelection(text, context) {
  const loading = document.getElementById('loading');
  const statusContainer = document.getElementById('status-container');
  const meaningContainer = document.getElementById('meaning-container');
  const warningContainer = document.getElementById('warning-container');
  const sourceContainer = document.getElementById('source-container');

  loading.style.display = 'block';
  statusContainer.innerHTML = '';
  meaningContainer.innerHTML = '';
  warningContainer.innerHTML = '';
  sourceContainer.innerHTML = '';

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
      let badgeClass = 'status-matched';
      let icon = '✓ ';
      if (rep.status === 'NEEDS_REVIEW') {
        badgeClass = 'status-review';
        icon = '⚠ ';
      } else if (rep.status === 'NOT_FOUND_IN_CHECKED_SOURCES') {
        badgeClass = 'status-notfound';
        icon = '↗ ';
      } else if (rep.status === 'REFER_TO_SPECIALIST') {
        badgeClass = 'status-referral';
        icon = '→ ';
      }

      statusContainer.innerHTML = `<span class="status-badge ${badgeClass}">${icon}${rep.status_label_ar}</span>`;

      if (rep.canonical_text || rep.jamhara_definition) {
        meaningContainer.innerHTML = `
          <div style="margin-top:6px;">
            <div class="label">المعنى والسياق المعتمد:</div>
            <div style="font-size:12px; line-height:1.5;">${rep.jamhara_definition || rep.canonical_text}</div>
          </div>
        `;
      }

      if (rep.reduction_warning) {
        warningContainer.innerHTML = `
          <div class="warning">
            <strong>تنبيه شرعي/سياقي:</strong> ${rep.reduction_warning}
          </div>
        `;
      }

      if (rep.citation) {
        sourceContainer.innerHTML = `
          <div class="source-box">
            <strong>المصدر:</strong> ${rep.citation.source_name}
            ${rep.citation.book ? ` | ${rep.citation.book}` : ''}
            ${rep.citation.grade ? ` | الدرجة: ${rep.citation.grade}` : ''}
          </div>
        `;
      }
    } else {
      statusContainer.innerHTML = `<span class="status-badge status-notfound">↗ لم يُعثر عليه في المراجع المفحوصة</span>`;
    }
  } catch (err) {
    loading.style.display = 'none';
    statusContainer.innerHTML = `<span class="status-badge status-review">فشل الاتصال بمحرك بصيرة</span>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Query active tab text
  if (chrome && chrome.tabs && chrome.tabs.sendMessage) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'get_selection' }, (response) => {
          if (response && response.text) {
            document.getElementById('selected-text').innerText = response.text;
            verifySelection(response.text, response.context || '');
          } else {
            verifySelection('Sharia', 'Islamic law and ethics');
          }
        });
      }
    });
  } else {
    // Demo fallback inside web iframe preview
    verifySelection('Sharia', 'Islamic law and guidance');
  }

  document.getElementById('check-btn').addEventListener('click', () => {
    const text = document.getElementById('selected-text').innerText;
    verifySelection(text, '');
  });
});
