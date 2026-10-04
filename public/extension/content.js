/**
 * Baseera Chrome Extension — Floating Content Script (Shadow DOM)
 * يوفر شارة عائمة (Floating Widget) تظهر فوراً عند تحديد أي نص في أي صفحة ويب
 * ويدعم فحص الصور مباشرة عبر النقر بالزر الأيمن (Right Click Image OCR)
 */

(function () {
  const API_LOOKUP_ENDPOINT = 'http://localhost:3000/api/extension-lookup';
  const API_IMAGE_ENDPOINT = 'http://localhost:3000/api/extension-lookup-image';

  // Create isolated container with Shadow DOM to prevent host page CSS conflicts
  const hostDiv = document.createElement('div');
  hostDiv.id = 'baseera-extension-root';
  hostDiv.style.all = 'initial';
  hostDiv.style.position = 'absolute';
  hostDiv.style.top = '0';
  hostDiv.style.left = '0';
  hostDiv.style.zIndex = '2147483647';
  document.documentElement.appendChild(hostDiv);

  const shadow = hostDiv.attachShadow({ mode: 'open' });

  // CSS Styles inside Shadow DOM
  const style = document.createElement('style');
  style.textContent = `
    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Amiri", "Helvetica Neue", Arial, sans-serif;
    }
    
    .floating-btn {
      position: absolute;
      display: none;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #065f46 0%, #047857 100%);
      color: #ffffff;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(52, 211, 153, 0.4);
      z-index: 2147483647;
      direction: rtl;
      transition: transform 0.15s ease, background 0.15s ease;
      user-select: none;
    }
    .floating-btn:hover {
      transform: scale(1.05);
      background: linear-gradient(135deg, #047857 0%, #059669 100%);
    }
    .floating-btn .icon {
      font-size: 14px;
    }

    .floating-card {
      position: absolute;
      display: none;
      width: 380px;
      max-width: 92vw;
      background: #090d16;
      color: #f1f5f9;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08);
      z-index: 2147483647;
      direction: rtl;
      font-size: 13px;
      line-height: 1.5;
      animation: baseeraFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes baseeraFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .card-title {
      display: flex;
      align-items: center;
      gap: 7px;
      font-weight: 800;
      color: #34d399;
      font-size: 14px;
    }
    .card-title .dot {
      color: #10b981;
      font-size: 16px;
    }
    .close-btn {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 20px;
      cursor: pointer;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .close-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }

    .preview-box {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 8px 10px;
      margin-bottom: 10px;
      font-size: 12px;
      color: #cbd5e1;
      max-height: 75px;
      overflow-y: auto;
      word-break: break-word;
    }
    .preview-box strong {
      color: #38bdf8;
      display: block;
      margin-bottom: 2px;
      font-size: 11px;
    }

    .verdict-box {
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 10px;
      font-size: 12px;
    }
    .verdict-matched {
      background: rgba(6, 78, 59, 0.55);
      border: 1px solid rgba(5, 150, 105, 0.7);
      color: #a7f3d0;
    }
    .verdict-review {
      background: rgba(120, 53, 15, 0.55);
      border: 1px solid rgba(217, 119, 6, 0.7);
      color: #fde68a;
    }
    .verdict-notfound {
      background: rgba(30, 41, 59, 0.75);
      border: 1px solid #334155;
      color: #cbd5e1;
    }

    .verdict-heading {
      font-weight: 800;
      font-size: 13px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .verdict-source {
      font-size: 11px;
      opacity: 0.9;
    }

    .canonical-text {
      background: rgba(0, 0, 0, 0.4);
      border-right: 3px solid #10b981;
      padding: 8px 10px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 10px;
      font-size: 12px;
      max-height: 120px;
      overflow-y: auto;
      line-height: 1.6;
    }

    .btn-group {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .btn-action {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: #059669;
      color: #ffffff;
      padding: 8px 10px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-action:hover {
      background: #10b981;
    }

    .btn-secondary {
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-secondary:hover {
      background: #334155;
      color: #ffffff;
    }

    .ocr-toggle-content {
      display: none;
      margin-top: 10px;
      padding: 8px 10px;
      background: rgba(0, 0, 0, 0.45);
      border: 1px dashed #334155;
      border-radius: 6px;
      font-size: 11px;
      color: #94a3b8;
      max-height: 80px;
      overflow-y: auto;
      line-height: 1.5;
    }

    .loader {
      text-align: center;
      padding: 18px 10px;
      color: #94a3b8;
      font-size: 12px;
    }
    .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(52, 211, 153, 0.3);
      border-radius: 50%;
      border-top-color: #34d399;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-left: 6px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  shadow.appendChild(style);

  // Floating Trigger Button for Text
  const floatBtn = document.createElement('div');
  floatBtn.className = 'floating-btn';
  floatBtn.innerHTML = `<span class="icon">🔎</span><span>تحقّق ببصيرة</span>`;
  shadow.appendChild(floatBtn);

  // Floating Trigger Button for Images (Hover)
  const imageHoverBtn = document.createElement('div');
  imageHoverBtn.className = 'floating-btn';
  imageHoverBtn.innerHTML = `<span class="icon">🔎</span><span>تحقق ببصيرة</span>`;
  imageHoverBtn.style.fontSize = '12px';
  imageHoverBtn.style.padding = '5px 11px';
  shadow.appendChild(imageHoverBtn);

  let currentHoveredImg = null;
  let hoverTimeout = null;

  // Floating Verdict Card
  const floatCard = document.createElement('div');
  floatCard.className = 'floating-card';
  shadow.appendChild(floatCard);

  let currentSelectedText = '';
  let currentSelectionRect = null;
  let lastRightClickPos = { x: 100, y: 100, target: null };

  // Image Hover Tracking (Facebook, Twitter, Web Articles)
  document.addEventListener('mouseover', (e) => {
    const target = e.target;
    if (target && target.tagName === 'IMG' && (target.naturalWidth >= 160 || target.clientWidth >= 160) && (target.naturalHeight >= 100 || target.clientHeight >= 100)) {
      currentHoveredImg = target;
      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(() => {
        if (!currentHoveredImg) return;
        const rect = currentHoveredImg.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 60) return;
        imageHoverBtn.style.top = `${window.scrollY + rect.top + 8}px`;
        imageHoverBtn.style.left = `${window.scrollX + rect.left + 8}px`;
        imageHoverBtn.style.display = 'flex';
      }, 300);
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (e.target === currentHoveredImg) {
      hoverTimeout = setTimeout(() => {
        imageHoverBtn.style.display = 'none';
        currentHoveredImg = null;
      }, 800);
    }
  });

  imageHoverBtn.addEventListener('mouseenter', () => {
    clearTimeout(hoverTimeout);
  });

  imageHoverBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentHoveredImg) return;
    const src = currentHoveredImg.currentSrc || currentHoveredImg.src;
    const rect = currentHoveredImg.getBoundingClientRect();
    imageHoverBtn.style.display = 'none';
    positionCard({
      x: window.scrollX + rect.left,
      y: window.scrollY + rect.bottom + 8
    });
    renderLoading(src, 'image');
    executeImageLookup(src);
  });

  // Track right-click position and target
  document.addEventListener('contextmenu', (e) => {
    lastRightClickPos = {
      x: e.pageX,
      y: e.pageY,
      target: e.target
    };
  });

  // Listen for mouseup selection across the entire document
  document.addEventListener('mouseup', (e) => {
    // If click inside our floating UI, do nothing
    if (e.composedPath && e.composedPath().some(el => el === hostDiv || el === floatBtn || el === floatCard)) {
      return;
    }

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';

      if (text && text.length >= 3) {
        currentSelectedText = text;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        currentSelectionRect = rect;

        // Position floating button right below selection
        const top = window.scrollY + rect.bottom + 8;
        const left = Math.max(10, Math.min(window.innerWidth - 140, window.scrollX + rect.left));

        floatBtn.style.top = `${top}px`;
        floatBtn.style.left = `${left}px`;
        floatBtn.style.display = 'flex';
      } else {
        floatBtn.style.display = 'none';
      }
    }, 10);
  });

  // Hide button and card on mousedown outside
  document.addEventListener('mousedown', (e) => {
    if (e.composedPath && e.composedPath().some(el => el === hostDiv || el === floatBtn || el === floatCard)) {
      return;
    }
    floatBtn.style.display = 'none';
    floatCard.style.display = 'none';
  });

  // Trigger verification when floating button is clicked
  floatBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    floatBtn.style.display = 'none';
    if (!currentSelectedText) return;

    positionCard(currentSelectionRect ? {
      x: window.scrollX + currentSelectionRect.left,
      y: window.scrollY + currentSelectionRect.bottom + 8
    } : null);

    renderLoading(currentSelectedText, 'text');
    executeTextLookup(currentSelectedText);
  });

  function positionCard(coords) {
    let top = 100;
    let left = 100;

    if (coords) {
      top = coords.y;
      left = Math.max(15, Math.min(window.innerWidth - 410, coords.x));
    } else if (lastRightClickPos) {
      top = lastRightClickPos.y + 10;
      left = Math.max(15, Math.min(window.innerWidth - 410, lastRightClickPos.x - 100));
    }

    floatCard.style.top = `${top}px`;
    floatCard.style.left = `${left}px`;
    floatCard.style.display = 'block';
  }

  function renderLoading(previewContent, type = 'text') {
    floatCard.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <span class="dot">◉</span>
          <span>بصيرة — التحقق الفوري</span>
        </div>
        <button class="close-btn" id="baseera-close-btn">&times;</button>
      </div>
      <div class="preview-box">
        <strong>${type === 'image' ? 'الصورة المفحوصة:' : 'النص المحدد:'}</strong>
        ${escapeHtml(previewContent)}
      </div>
      <div class="loader">
        <span class="spinner"></span>
        ${type === 'image' 
          ? 'جارٍ قراءة النص من الصورة بالذكاء الاصطناعي (OCR) والتحقق من الدرر السنية...' 
          : 'جارٍ التحقق من المراجع المعتمدة (الدرر السنية والقرآن)...'}
      </div>
    `;

    shadow.getElementById('baseera-close-btn').onclick = () => {
      floatCard.style.display = 'none';
    };
  }

  async function executeTextLookup(text) {
    // 1. Primary: Use background service worker (Bypasses all host page CSP, CORS, & Mixed Content)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'api_lookup', text, context: '' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          doDirectFetchText(text);
          return;
        }
        if (response.success && response.data) {
          renderVerdict(text, response.data.report);
        } else {
          renderError(text, (response.data && response.data.error) || response.error || 'تعذر استلام نتيجة التحقق من سيرفر بصيرة.');
        }
      });
      return;
    }
    doDirectFetchText(text);
  }

  async function doDirectFetchText(text) {
    try {
      const res = await fetch(API_LOOKUP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context: '' })
      });
      const data = await res.json();
      renderVerdict(text, data.report);
    } catch (err) {
      renderError(text, 'تعذر الاتصال بسيرفر بصيرة المحلي (http://localhost:3000). يرجى التأكد من تشغيل السيرفر أو تحديث إضافة المتصفح.');
    }
  }

  async function executeImageLookup(srcUrl) {
    let imageBase64 = null;

    // Try capturing element canvas if element is available and on same origin/cache
    if (lastRightClickPos.target && lastRightClickPos.target.tagName === 'IMG') {
      try {
        const imgEl = lastRightClickPos.target;
        if (imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = imgEl.naturalWidth;
          canvas.height = imgEl.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(imgEl, 0, 0);
          imageBase64 = canvas.toDataURL('image/jpeg', 0.85);
        }
      } catch (canvasErr) {
        // Cross-origin tainted canvas fallback
      }
    }

    // 1. Primary: Use background service worker (Bypasses all host page CSP, CORS, & Mixed Content)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'api_lookup_image',
        imageUrl: srcUrl,
        imageBase64: imageBase64
      }, (response) => {
        if (chrome.runtime.lastError || !response) {
          doDirectFetchImage(srcUrl, imageBase64);
          return;
        }
        if (response.success && response.data) {
          renderVerdict(response.data.extractedText || srcUrl, response.data.report, {
            isImage: true,
            extractedText: response.data.extractedText
          });
        } else {
          renderError(srcUrl, (response.data && response.data.error) || response.error || 'فشلت معالجة صورة الحديث.');
        }
      });
      return;
    }

    doDirectFetchImage(srcUrl, imageBase64);
  }

  async function doDirectFetchImage(srcUrl, imageBase64) {
    try {
      const res = await fetch(API_IMAGE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: srcUrl,
          imageBase64: imageBase64
        })
      });

      const data = await res.json();
      if (!res.ok) {
        renderError(srcUrl, data.error || 'فشلت معالجة صورة الحديث.');
        return;
      }

      renderVerdict(data.extractedText || srcUrl, data.report, {
        isImage: true,
        extractedText: data.extractedText
      });
    } catch (err) {
      renderError(srcUrl, 'تعذر الاتصال بسيرفر بصيرة المحلي لفحص الصورة. يرجى التأكد من تشغيل السيرفر.');
    }
  }

  function renderVerdict(previewText, report, opts = {}) {
    if (!report) {
      renderError(previewText, 'لم يتم تلقي تقرير من المحرك.');
      return;
    }

    let cardClass = 'verdict-matched';
    let icon = '✓ ';
    if (report.status === 'NEEDS_REVIEW') {
      cardClass = 'verdict-review';
      icon = '⚠️ ';
    } else if (report.status === 'NOT_FOUND_IN_CHECKED_SOURCES') {
      cardClass = 'verdict-notfound';
      icon = '❓ ';
    }

    const sourceName = report.citation ? `${report.citation.source_name}${report.citation.book ? ' · ' + report.citation.book : ''}` : 'الدرر السنية';
    const canonical = report.canonical_text || report.reason || '';
    const linkUrl = report.citation?.url || '';

    const label = report.status_label_ar || report.status;
    const hasEmoji = /^[✓⚠️⛔❓✅📖]/.test(label);
    const displayHeading = hasEmoji ? label : `${icon}${label}`;

    floatCard.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <span class="dot">◉</span>
          <span>بصيرة</span>
        </div>
        <button class="close-btn" id="baseera-close-btn">&times;</button>
      </div>

      <div class="verdict-box ${cardClass}">
        <div class="verdict-heading">${displayHeading}</div>
        <div class="verdict-source"><strong>المصدر المفحوص:</strong> ${escapeHtml(sourceName)}</div>
      </div>

      ${canonical ? `
        <div class="canonical-text">
          <div style="font-size:10px; color:#34d399; font-weight:bold; margin-bottom:3px;">الحكم / النص المعتمد:</div>
          <div>${escapeHtml(canonical.slice(0, 400))}${canonical.length > 400 ? '...' : ''}</div>
        </div>
      ` : ''}

      <div class="btn-group">
        ${linkUrl ? `
          <a href="${escapeHtml(linkUrl)}" target="_blank" class="btn-action">
            <span>عرض الدليل</span>
            <span>↗</span>
          </a>
        ` : ''}

        ${opts.isImage && opts.extractedText ? `
          <button class="btn-secondary" id="baseera-ocr-btn">
            <span>النص المستخرج</span>
          </button>
        ` : ''}
      </div>

      ${opts.isImage && opts.extractedText ? `
        <div class="ocr-toggle-content" id="baseera-ocr-box">
          <strong style="color:#38bdf8; display:block; margin-bottom:2px;">النص المقروء من الصورة:</strong>
          ${escapeHtml(opts.extractedText)}
        </div>
      ` : ''}
    `;

    shadow.getElementById('baseera-close-btn').onclick = () => {
      floatCard.style.display = 'none';
    };

    if (opts.isImage && opts.extractedText) {
      const ocrBtn = shadow.getElementById('baseera-ocr-btn');
      const ocrBox = shadow.getElementById('baseera-ocr-box');
      if (ocrBtn && ocrBox) {
        ocrBtn.onclick = () => {
          ocrBox.style.display = ocrBox.style.display === 'block' ? 'none' : 'block';
        };
      }
    }
  }

  function renderError(text, errorMsg) {
    floatCard.innerHTML = `
      <div class="card-header">
        <div class="card-title" style="color:#ef4444;">
          <span class="dot">◉</span>
          <span>تعذر التحقق</span>
        </div>
        <button class="close-btn" id="baseera-close-btn">&times;</button>
      </div>
      <div class="verdict-box verdict-review">
        <div class="verdict-heading">⚠️ تنبيه</div>
        <div>${escapeHtml(errorMsg)}</div>
      </div>
    `;

    shadow.getElementById('baseera-close-btn').onclick = () => {
      floatCard.style.display = 'none';
    };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Handle messages from context menus or popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'get_selection') {
        const selection = window.getSelection();
        const text = selection ? selection.toString().trim() : '';
        sendResponse({ text });
      } else if (request.action === 'baseera_verify_selection') {
        const textToVerify = (request.text || '').trim();
        if (textToVerify) {
          positionCard(null);
          renderLoading(textToVerify, 'text');
          executeTextLookup(textToVerify);
        }
      } else if (request.action === 'baseera_verify_image') {
        const srcUrl = request.srcUrl;
        if (srcUrl) {
          positionCard(null);
          renderLoading(srcUrl, 'image');
          executeImageLookup(srcUrl);
        }
      }
    });
  }
})();
