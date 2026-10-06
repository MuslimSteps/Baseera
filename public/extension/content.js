/**
 * @license
 * Baseera Chrome Extension — Floating Content Script (Shadow DOM)
 * يوفر طبقة تحقق فورية وسياقية عائمة للقرآن والحديث والمصطلحات والفقه
 * ويدعم فحص الصور وتغريدات ومنشورات الويب مباشرة (OCR + Deterministic Verification)
 */

(function () {
  const DEFAULT_API_BASE = 'https://baseera.onrender.com';
  async function getDirectApiBase() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const res = await chrome.storage.local.get('baseera_api_base');
        return res.baseera_api_base || DEFAULT_API_BASE;
      }
    } catch {}
    return DEFAULT_API_BASE;
  }

  // 1. Create isolated container with Shadow DOM to prevent host page CSS conflicts
  const hostDiv = document.createElement('div');
  hostDiv.id = 'baseera-extension-root';
  hostDiv.style.all = 'initial';
  hostDiv.style.position = 'absolute';
  hostDiv.style.top = '0';
  hostDiv.style.left = '0';
  hostDiv.style.zIndex = '2147483647';
  document.documentElement.appendChild(hostDiv);

  const shadow = hostDiv.attachShadow({ mode: 'open' });

  // 2. CSS Styles inside Shadow DOM (Light, Scholarly Islamic Theme)
  const style = document.createElement('style');
  style.textContent = `
    * {
      box-sizing: border-box;
      font-family: 'Amiri', 'Noto Naskh Arabic', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    .floating-btn {
      position: absolute;
      display: none;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: #ffffff;
      padding: 7px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(5, 150, 105, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.4);
      z-index: 2147483647;
      direction: rtl;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      user-select: none;
    }
    .floating-btn:hover {
      transform: scale(1.05);
      background: linear-gradient(135deg, #047857 0%, #065f46 100%);
      box-shadow: 0 8px 25px rgba(5, 150, 105, 0.45);
    }
    .floating-btn .icon {
      font-size: 14px;
    }

    .image-hover-btn {
      position: absolute;
      display: none;
      align-items: center;
      gap: 6px;
      background: #0f172a;
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
      z-index: 2147483646;
      direction: rtl;
      transition: all 0.15s ease;
      user-select: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .image-hover-btn:hover {
      background: #059669;
      transform: translateY(-1px);
    }

    .floating-card {
      position: absolute;
      display: none;
      width: 400px;
      max-width: 94vw;
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 20px 45px -10px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.08);
      z-index: 2147483647;
      direction: rtl;
      font-size: 13px;
      line-height: 1.6;
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
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .card-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-logo-badge {
      width: 24px;
      height: 24px;
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: #ffffff;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 12px;
    }
    .card-title {
      font-weight: 800;
      color: #0f172a;
      font-size: 14px;
    }
    .card-subtitle {
      font-size: 10px;
      color: #64748b;
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
      transition: color 0.15s;
    }
    .close-btn:hover {
      color: #0f172a;
      background: #f1f5f9;
    }

    .preview-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 9px 12px;
      margin-bottom: 10px;
      font-size: 12px;
      color: #334155;
      max-height: 75px;
      overflow-y: auto;
      word-break: break-word;
      line-height: 1.5;
    }
    .preview-box strong {
      color: #0369a1;
      display: block;
      margin-bottom: 2px;
      font-size: 11px;
    }

    .verdict-box {
      border-radius: 12px;
      padding: 11px 12px;
      margin-bottom: 10px;
      font-size: 12.5px;
    }
    .verdict-matched {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
    }
    .verdict-review {
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
    }
    .verdict-notfound {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #475569;
    }
    .verdict-referral {
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      color: #5b21b6;
    }

    .verdict-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .verdict-heading {
      font-weight: 800;
      font-size: 13.5px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .type-pill-tag {
      font-size: 9.5px;
      padding: 2px 7px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.9);
      font-weight: 800;
      border: 1px solid currentColor;
    }
    .verdict-source {
      font-size: 11.5px;
      opacity: 0.95;
      margin-top: 3px;
    }

    .canonical-text {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-right: 4px solid #059669;
      padding: 10px 12px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 10px;
      font-size: 12.5px;
      max-height: 120px;
      overflow-y: auto;
      line-height: 1.65;
      color: #1e293b;
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
      background: #0f172a;
      color: #ffffff;
      padding: 9px 12px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-action:hover {
      background: #1e293b;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
      padding: 9px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
      color: #0f172a;
    }

    .ocr-toggle-content {
      display: none;
      margin-top: 10px;
      padding: 9px 12px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      font-size: 11.5px;
      color: #475569;
      max-height: 85px;
      overflow-y: auto;
      line-height: 1.55;
    }

    .schools-box {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #e2e8f0;
    }
    .school-line {
      display: flex;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 11.5px;
    }
    .school-name {
      font-weight: 800;
      color: #047857;
      min-width: 65px;
    }

    .loader {
      text-align: center;
      padding: 20px 10px;
      color: #64748b;
      font-size: 12.5px;
    }
    .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid rgba(5, 150, 105, 0.2);
      border-radius: 50%;
      border-top-color: #059669;
      animation: baseeraSpin 0.7s linear infinite;
      margin-bottom: 8px;
    }
    @keyframes baseeraSpin {
      to { transform: rotate(360deg); }
    }
  `;
  shadow.appendChild(style);

  // 3. Create Elements
  const floatBtn = document.createElement('div');
  floatBtn.className = 'floating-btn';
  floatBtn.innerHTML = `
    <span class="icon">✦</span>
    <span>بصيرة · تحقّق</span>
  `;
  shadow.appendChild(floatBtn);

  const imageHoverBtn = document.createElement('div');
  imageHoverBtn.className = 'image-hover-btn';
  imageHoverBtn.innerHTML = `
    <span>🔎</span>
    <span>تحقّق من الصورة عبر بصيرة</span>
  `;
  shadow.appendChild(imageHoverBtn);

  const floatCard = document.createElement('div');
  floatCard.className = 'floating-card';
  shadow.appendChild(floatCard);

  // State
  let currentSelectedText = '';
  let currentSelectionRect = null;
  let lastRightClickPos = null;
  let currentHoveredImg = null;
  let hoverTimeout = null;

  // Detect Item Type Helper
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
        return { label: '⚖️ فقه إسلامي', defaultSource: 'الموسوعة الفقهية / أقوال المذاهب' };
      default:
        return { label: '🔍 محتوى إسلامي', defaultSource: 'المصادر المعتمدة في بصيرة' };
    }
  }

  // Hover over images to show "Verify Image" button
  document.addEventListener('mouseover', (e) => {
    if (e.target && e.target.tagName === 'IMG') {
      const img = e.target;
      if (img.naturalWidth < 120 || img.naturalHeight < 120) return;

      currentHoveredImg = img;
      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(() => {
        if (currentHoveredImg === img) {
          const rect = img.getBoundingClientRect();
          imageHoverBtn.style.top = `${window.scrollY + rect.top + 8}px`;
          imageHoverBtn.style.left = `${Math.max(10, window.scrollX + rect.right - 180)}px`;
          imageHoverBtn.style.display = 'flex';
        }
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

  // Listen for text selection
  document.addEventListener('mouseup', (e) => {
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

        const top = window.scrollY + rect.bottom + 8;
        const left = Math.max(10, Math.min(window.innerWidth - 150, window.scrollX + rect.left));

        floatBtn.style.top = `${top}px`;
        floatBtn.style.left = `${left}px`;
        floatBtn.style.display = 'flex';
      } else {
        floatBtn.style.display = 'none';
      }
    }, 10);
  });

  // Hide button and card on click outside
  document.addEventListener('mousedown', (e) => {
    if (e.composedPath && e.composedPath().some(el => el === hostDiv || el === floatBtn || el === floatCard)) {
      return;
    }
    floatBtn.style.display = 'none';
    floatCard.style.display = 'none';
  });

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
      left = Math.max(15, Math.min(window.innerWidth - 420, coords.x));
    } else if (lastRightClickPos) {
      top = lastRightClickPos.y + 10;
      left = Math.max(15, Math.min(window.innerWidth - 420, lastRightClickPos.x - 100));
    }

    floatCard.style.top = `${top}px`;
    floatCard.style.left = `${left}px`;
    floatCard.style.display = 'block';
  }

  function renderLoading(previewContent, type = 'text') {
    floatCard.innerHTML = `
      <div class="card-header">
        <div class="card-title-wrap">
          <div class="card-logo-badge">ب</div>
          <div>
            <div class="card-title">بصيرة — التحقق الفوري</div>
            <div class="card-subtitle">فحص المطابقة والإسناد المباشر</div>
          </div>
        </div>
        <button class="close-btn" id="baseera-close-btn">&times;</button>
      </div>

      <div class="preview-box">
        <strong>${type === 'image' ? 'الصورة المفحوصة:' : 'النص المحدد:'}</strong>
        ${escapeHtml(previewContent)}
      </div>

      <div class="loader">
        <span class="spinner"></span>
        <div>
          ${type === 'image' 
            ? 'جارٍ قراءة النص بالذكاء الاصطناعي (OCR) والتحقق في المصادر المعتمدة...' 
            : 'جارٍ الفحص في مجمع المصحف، الدرر السنية، الجمهرة، والموسوعات الفقهية...'}
        </div>
      </div>
    `;

    shadow.getElementById('baseera-close-btn').onclick = () => {
      floatCard.style.display = 'none';
    };
  }

  async function executeTextLookup(text) {
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
      const apiBase = await getDirectApiBase();
      const res = await fetch(`${apiBase}/api/extension-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context: '' })
      });
      const data = await res.json();
      renderVerdict(text, data.report);
    } catch (err) {
      renderError(text, 'تعذر الاتصال بسيرفر بصيرة. يرجى التحقق من الاتصال بالإنترنت أو حالة الخدمة.');
    }
  }

  async function executeImageLookup(srcUrl) {
    let imageBase64 = null;

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
        // Cross-origin fallback
      }
    }

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
      const apiBase = await getDirectApiBase();
      const res = await fetch(`${apiBase}/api/extension-lookup-image`, {
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

    const itemType = detectItemType(report);
    const typeMeta = getItemTypeMeta(itemType);

    let cardClass = 'verdict-matched';
    let icon = '✓';
    if (report.status === 'NEEDS_REVIEW') {
      cardClass = 'verdict-review';
      icon = '⚠️';
    } else if (report.status === 'NOT_FOUND_IN_CHECKED_SOURCES') {
      cardClass = 'verdict-notfound';
      icon = '❓';
    } else if (report.status === 'REFER_TO_SPECIALIST') {
      cardClass = 'verdict-referral';
      icon = '⚖️';
    }

    const sourceName = report.citation ? `${report.citation.source_name}${report.citation.book ? ' · ' + report.citation.book : ''}` : typeMeta.defaultSource;
    const grade = report.citation?.grade ? ` · [${report.citation.grade}]` : '';
    const canonical = report.canonical_text || report.reason || '';
    const linkUrl = report.citation?.url || '';

    let actionBtnLabel = `عرض الدليل في ${escapeHtml(report.citation?.source_name || 'المصدر')}`;
    if (itemType === 'quran') actionBtnLabel = 'عرض التوثيق في مجمع الملك فهد / المصحف';
    else if (itemType === 'hadith') actionBtnLabel = 'عرض التخريج والحكم في الدرر السنية';
    else if (itemType === 'term') actionBtnLabel = 'عرض المصطلح في موسوعة الجمهرة';
    else if (itemType === 'fiqh') actionBtnLabel = 'عرض المسألة وأقوال المذاهب';

    const label = report.status_label_ar || report.status;

    floatCard.innerHTML = `
      <div class="card-header">
        <div class="card-title-wrap">
          <div class="card-logo-badge">ب</div>
          <div>
            <div class="card-title">بصيرة — نتيجة الفحص</div>
            <div class="card-subtitle">تم التوثيق عبر الحزمة العلمية المعتمدة</div>
          </div>
        </div>
        <button class="close-btn" id="baseera-close-btn">&times;</button>
      </div>

      <div class="verdict-box ${cardClass}">
        <div class="verdict-header-row">
          <div class="verdict-heading">
            <span>${icon}</span>
            <span>${escapeHtml(label)}</span>
          </div>
          <span class="type-pill-tag">${typeMeta.label}</span>
        </div>
        <div class="verdict-source"><strong>المصدر:</strong> ${escapeHtml(sourceName)}${escapeHtml(grade)}</div>
      </div>

      ${canonical ? `
        <div class="canonical-text">
          <div style="font-size:10.5px; color:#047857; font-weight:800; margin-bottom:4px;">الحكم / النص المعتمد:</div>
          <div>${escapeHtml(canonical.slice(0, 450))}${canonical.length > 450 ? '...' : ''}</div>
        </div>
      ` : ''}

      ${report.school_positions && report.school_positions.length > 0 ? `
        <div class="schools-box">
          <div style="font-size:11px; font-weight:800; color:#047857; margin-bottom:4px;">أقوال المذاهب الفقهية:</div>
          ${report.school_positions.map((s) => `
            <div class="school-line">
              <span class="school-name">${escapeHtml(s.school)}:</span>
              <span>${escapeHtml(s.view || s.ruling || '')}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="btn-group">
        ${linkUrl ? `
          <a href="${escapeHtml(linkUrl)}" target="_blank" class="btn-action">
            <span>${actionBtnLabel}</span>
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
          <strong style="color:#0369a1; display:block; margin-bottom:2px;">النص المقروء من الصورة:</strong>
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
        <div class="card-title-wrap">
          <div class="card-logo-badge" style="background:#dc2626;">!</div>
          <div>
            <div class="card-title">تنبيه في الفحص</div>
            <div class="card-subtitle">محرك بصيرة للتحقق الفوري</div>
          </div>
        </div>
        <button class="close-btn" id="baseera-close-btn">&times;</button>
      </div>

      <div class="verdict-box verdict-review">
        <div class="verdict-heading">⚠️ تعذر إتمام التحقق</div>
        <div style="margin-top:4px;">${escapeHtml(errorMsg)}</div>
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
