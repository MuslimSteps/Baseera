/**
 * @license
 * Baseera Chrome Extension Popup Script
 * Fast, Deterministic Verification for Quran, Hadith, Terminology & Fiqh
 */

const API_BASE = 'http://localhost:3000';
let currentTypeFilter = 'auto';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function detectItemType(rep) {
  if (rep?.item_type) return rep.item_type;
  const src = (rep?.citation?.source_name || '').toLowerCase();
  const cat = (rep?.category || '').toLowerCase();
  const book = (rep?.citation?.book || '').toLowerCase();

  if (cat.includes('quran') || src.includes('quran') || src.includes('قرآن') || src.includes('مجمع الملك فهد')) {
    return 'quran';
  }
  if (cat.includes('hadith') || src.includes('hadith') || src.includes('حديث') || src.includes('درر') || book.includes('بخاري') || book.includes('مسلم')) {
    return 'hadith';
  }
  if (cat.includes('term') || src.includes('جمهرة') || src.includes('مصطلح') || src.includes('قاموس')) {
    return 'term';
  }
  if (cat.includes('fiqh') || src.includes('فقه') || rep?.school_positions) {
    return 'fiqh';
  }
  return 'claim';
}

function getItemTypeMeta(type) {
  switch (type) {
    case 'quran':
      return { label: '📖 القرآن الكريم', defaultSource: 'مجمع الملك فهد لطباعة المصحف الشريف' };
    case 'hadith':
      return { label: '📜 الحديث النبوي', defaultSource: 'موسوعة الحديث الشريف (الدرر السنية)' };
    case 'term':
      return { label: '📚 مصطلح شرعي', defaultSource: 'موسوعة الجمهرة لمفردات المحتوى الإسلامي' };
    case 'fiqh':
      return { label: '⚖️ فقه إسلامي', defaultSource: 'الموسوعة الفقهية / أقوال المذاهب الأربعة' };
    default:
      return { label: '🔍 محتوى إسلامي', defaultSource: 'المصادر المعتمدة في بصيرة' };
  }
}

async function verifySelection(text, context = '') {
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

  const fullContext = currentTypeFilter !== 'auto'
    ? `[فحص محدد: ${currentTypeFilter}] ${context}`.trim()
    : context;

  try {
    const res = await fetch(`${API_BASE}/api/extension-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context: fullContext })
    });

    const data = await res.json();
    loading.style.display = 'none';

    if (data.report) {
      const rep = data.report;
      const itemType = detectItemType(rep);
      const typeMeta = getItemTypeMeta(itemType);

      let cardClass = 'verdict-matched';
      let icon = '✓';
      if (rep.status === 'NEEDS_REVIEW') {
        cardClass = 'verdict-review';
        icon = '⚠️';
      } else if (rep.status === 'NOT_FOUND_IN_CHECKED_SOURCES') {
        cardClass = 'verdict-notfound';
        icon = '❓';
      } else if (rep.status === 'REFER_TO_SPECIALIST') {
        cardClass = 'verdict-referral';
        icon = '⚖️';
      }

      const label = rep.status_label_ar || rep.status;
      const sourceName = rep.citation?.source_name || typeMeta.defaultSource;
      const bookName = rep.citation?.book || '';
      const grade = rep.citation?.grade || '';

      // 1. Verdict Card
      verdictContainer.innerHTML = `
        <div class="verdict-card ${cardClass}">
          <div class="verdict-header-row">
            <div class="verdict-title">
              <span>${icon}</span>
              <span>${escapeHtml(label)}</span>
            </div>
            <span class="type-tag">${typeMeta.label}</span>
          </div>

          <div class="verdict-source">
            <span class="source-tag">المصدر المعتمد:</span> ${escapeHtml(sourceName)}
            ${bookName ? ` · <span style="opacity:0.9;">${escapeHtml(bookName)}</span>` : ''}
            ${grade ? ` · <strong style="color:#047857;">[${escapeHtml(grade)}]</strong>` : ''}
          </div>
        </div>
      `;

      // 2. Canonical Evidence Box
      const mainText = rep.canonical_text || rep.reason;
      if (mainText) {
        canonicalContainer.innerHTML = `
          <div class="canonical-box">
            <div class="canonical-header">
              <span>✦</span>
              <span>النص أو الحكم المعتمد في المرجع:</span>
            </div>
            <div class="canonical-content">${escapeHtml(mainText)}</div>
          </div>
        `;
      }

      // 3. One-Click Evidence Link Button
      if (rep.citation && rep.citation.url) {
        let btnText = `عرض الدليل في ${escapeHtml(sourceName)}`;
        if (itemType === 'quran') btnText = 'عرض التوثيق في مجمع الملك فهد / المصحف';
        else if (itemType === 'hadith') btnText = 'عرض التخريج والحكم في الدرر السنية';
        else if (itemType === 'term') btnText = 'عرض المصطلح في موسوعة الجمهرة';
        else if (itemType === 'fiqh') btnText = 'عرض المسألة وأقوال المذاهب';

        actionContainer.innerHTML = `
          <a href="${encodeURI(rep.citation.url)}" target="_blank" class="btn-verify">
            <span>${btnText}</span>
            <span class="arrow">↗</span>
          </a>
        `;
      }

      // 4. Expandable Details (Schools, Differences, Reason, Reduction Warning)
      let detailsHtml = '';

      if (rep.reason && rep.canonical_text) {
        detailsHtml += `
          <div style="margin-bottom:8px;">
            <strong style="color:#0f172a; display:block; margin-bottom:2px;">بيان المحرك والتحليل:</strong>
            ${escapeHtml(rep.reason)}
          </div>
        `;
      }

      // Fiqh School Positions
      if (rep.school_positions && rep.school_positions.length > 0) {
        detailsHtml += `
          <div class="schools-container">
            <strong style="display:block; margin-bottom:4px; color:#047857;">أقوال المذاهب الفقهية الأربعة (دون ترجيح آلي):</strong>
            ${rep.school_positions.map((s) => `
              <div class="school-row">
                <span class="school-badge">${escapeHtml(s.school)}:</span>
                <span>${escapeHtml(s.view || s.ruling || '')}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      // Word Difference / Diff
      if (rep.diff && rep.diff.length > 0) {
        detailsHtml += `
          <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #cbd5e1;">
            <strong style="display:block; margin-bottom:4px; color:#b45309;">مقارنة الفروق النصية:</strong>
            <div style="font-family:'Amiri', serif; font-size:14px; line-height:1.8; background:#ffffff; padding:6px 10px; border-radius:6px; border:1px solid #e2e8f0;">
              ${rep.diff.map((d) => {
                if (d.type === 'matched') return `<span style="color:#047857;">${escapeHtml(d.word)} </span>`;
                if (d.type === 'missing') return `<span style="color:#b91c1c; text-decoration:line-through; background:#fee2e2; padding:1px 3px; border-radius:3px;">${escapeHtml(d.word)} </span>`;
                if (d.type === 'extra') return `<span style="color:#b45309; background:#fef3c7; padding:1px 3px; border-radius:3px;">${escapeHtml(d.word)} </span>`;
                return `<span>${escapeHtml(d.word)} </span>`;
              }).join('')}
            </div>
          </div>
        `;
      }

      if (rep.reduction_warning) {
        detailsHtml += `
          <div style="margin-top:8px; padding:6px 8px; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; color:#92400e;">
            <strong>تنبيه الاحتراز:</strong> ${escapeHtml(rep.reduction_warning)}
          </div>
        `;
      }

      if (detailsHtml) {
        detailsContainer.innerHTML = detailsHtml;
        toggleBtn.style.display = 'block';
        toggleBtn.onclick = () => {
          const isOpen = detailsContainer.style.display === 'block';
          detailsContainer.style.display = isOpen ? 'none' : 'block';
          toggleBtn.innerText = isOpen ? '▼ عرض تفاصيل التخريج والضوابط' : '▲ إخفاء التفاصيل';
        };
      }
    } else {
      verdictContainer.innerHTML = `
        <div class="verdict-card verdict-notfound">
          <div class="verdict-title">
            <span>❓</span>
            <span>لم يُثبت في المراجع المعتمدة — امتناع</span>
          </div>
          <div class="verdict-source">
            لم يُعثر على هذا اللفظ كحديث أو آية أو مسألة في النطاق المعتمد المفحوص، ويمتنع النظام عن التوليد غير المسند.
          </div>
        </div>
      `;
    }
  } catch (err) {
    loading.style.display = 'none';
    verdictContainer.innerHTML = `
      <div class="verdict-card verdict-review">
        <div class="verdict-title">
          <span>⚠️</span>
          <span>تعذر الاتصال بمحرك بصيرة</span>
        </div>
        <div class="verdict-source">
          تأكد من تشغيل السيرفر المحلي (<code style="background:#fff; padding:1px 4px; border-radius:3px;">http://localhost:3000</code>).
        </div>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const manualInput = document.getElementById('manual-input');
  const manualBtn = document.getElementById('manual-btn');
  const selectionBox = document.getElementById('selection-box');
  const selectedTextEl = document.getElementById('selected-text');
  const clearSelectionBtn = document.getElementById('clear-selection-btn');
  const typePills = document.querySelectorAll('.type-pill');

  // Filter Pills Handling
  typePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      typePills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      currentTypeFilter = pill.getAttribute('data-type') || 'auto';

      const currentText = selectedTextEl.innerText.trim() || manualInput.value.trim();
      if (currentText) {
        verifySelection(currentText, '');
      }
    });
  });

  // Clear Selection Handler
  clearSelectionBtn?.addEventListener('click', () => {
    selectedTextEl.innerText = '';
    selectionBox.style.display = 'none';
    manualInput.value = '';
    document.getElementById('verdict-container').innerHTML = '';
    document.getElementById('canonical-container').innerHTML = '';
    document.getElementById('action-container').innerHTML = '';
    document.getElementById('details-container').style.display = 'none';
    document.getElementById('toggle-details-btn').style.display = 'none';
  });

  // Manual Input Submit
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

  // Query Active Tab for Selected Text
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;

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
        // Fallback for restricted tabs
      }

      chrome.tabs.sendMessage(tab.id, { action: 'get_selection' }, (response) => {
        if (chrome.runtime?.lastError) return;
        if (response && response.text) {
          selectedTextEl.innerText = response.text;
          selectionBox.style.display = 'block';
          verifySelection(response.text, response.context || '');
        }
      });
    });
  }
});
