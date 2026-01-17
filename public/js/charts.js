// --- GALLERY MODAL FUNCTIONS ---
let modalImagesList = [];
let modalCurrentIndex = -1;
let galleryImagesCache = [];

// --- Modal image max-height shrink (for AI comment space) ---
function restoreModalImageMaxHeight() {
    const img = document.getElementById('modalImage');
    if (!img) return;
    img.style.maxHeight = '';
    img.dataset.aiShrink = 'off';
}

function shrinkModalImageMaxHeightBy30Percent() {
    const img = document.getElementById('modalImage');
    if (!img) return;
    // Уже уменьшено — не пересчитываем повторно
    if (img.dataset.aiShrink === 'on') return;

    const cs = window.getComputedStyle(img);
    const mh = cs.maxHeight;
    // Берём вычисленный max-height (в пикселях) и уменьшаем на 30%
    const mhPx = parseFloat(mh || '');
    if (!Number.isFinite(mhPx) || mhPx <= 0) return;

    img.style.maxHeight = `${Math.round(mhPx * 0.7)}px`;
    img.dataset.aiShrink = 'on';
}

function isPerplexityAnswerOk(answer) {
    const s = (answer ?? '').toString().trim();
    if (!s) return false;
    // callPerplexity возвращает ошибки в явном текстовом виде
    if (/^Ошибка:/u.test(s)) return false;
    if (/^Извините,/u.test(s)) return false;
    return true;
}

function getBrightnessIconSvgHtml(labelText) {
    const label = (labelText || 'Яркость +30%').toString();
    // SVG из запроса пользователя + sr-only подпись для доступности
    return `
        <span class="sr-only">${label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
    `.trim();
}

function setBrightnessButtonState(btn, isBoostOn) {
    if (!btn) return;
    if (isBoostOn) {
        btn.setAttribute('aria-pressed', 'true');
        btn.setAttribute('title', 'Оригинал');
        // Оставляем иконку, меняем только подсказку/состояние
        btn.innerHTML = getBrightnessIconSvgHtml('Оригинал');
        btn.classList.add('ring-2', 'ring-lime-400/40');
    } else {
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('title', 'Яркость +30%');
        btn.innerHTML = getBrightnessIconSvgHtml('Яркость +30%');
        btn.classList.remove('ring-2', 'ring-lime-400/40');
    }
}

function getFeaturedImageEntry() {
    const img = document.querySelector('.picture-frame-image');
    if (!img) return null;
    const path = img.getAttribute('src') || '';
    const name = img.getAttribute('alt') || 'Главная картина';
    if (!path) return null;
    return { path, name };
}

function rebuildModalImagesList() {
    const list = [];
    const featured = getFeaturedImageEntry();
    if (featured) list.push(featured);

    if (Array.isArray(galleryImagesCache)) {
        for (const item of galleryImagesCache) {
            if (item && item.path) list.push({ path: item.path, name: item.name || item.path });
        }
    }

    // Убираем дубликаты по path, сохраняя порядок
    const seen = new Set();
    modalImagesList = list.filter((it) => {
        if (!it || !it.path) return false;
        if (seen.has(it.path)) return false;
        seen.add(it.path);
        return true;
    });
}

function updateModalNavButtons() {
    const prevBtn = document.getElementById('modal-prev');
    const nextBtn = document.getElementById('modal-next');
    const hasMany = modalImagesList.length > 1;

    if (prevBtn) prevBtn.disabled = !hasMany;
    if (nextBtn) nextBtn.disabled = !hasMany;

    // Прячем кнопки, если навигация не нужна
    if (prevBtn) prevBtn.classList.toggle('hidden', !hasMany);
    if (nextBtn) nextBtn.classList.toggle('hidden', !hasMany);
}

function setModalContent(imageSrc, title) {
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalWidthWrap = document.getElementById('modal-width-wrap');
    const modalAiPanel = document.getElementById('modal-ai-panel');
    const modalAiText = document.getElementById('modal-ai-text');
    const modalAiButton = document.getElementById('modal-ai-button');
    const brightnessBtn = document.getElementById('modal-brightness-toggle');

    // При переходе к другой картине возвращаем исходную высоту изображения
    restoreModalImageMaxHeight();

    if (modalImage) modalImage.src = imageSrc;
    if (modalTitle) modalTitle.textContent = title;

    // Сброс "восстановления яркости" при смене картины
    if (modalImage) {
        modalImage.style.filter = '';
        modalImage.dataset.brightnessBoost = 'off';
    }
    if (brightnessBtn) {
        setBrightnessButtonState(brightnessBtn, false);
    }

    // Сбрасываем фиксированную ширину (пересчитаем после загрузки изображения)
    if (modalWidthWrap) {
        modalWidthWrap.style.width = '';
    }

    // Сбрасываем ИИ-панель при смене картины
    if (modalAiText) modalAiText.innerHTML = '';
    if (modalAiPanel) modalAiPanel.classList.add('hidden');
    if (modalAiButton) {
        modalAiButton.disabled = false;
        modalAiButton.textContent = 'ИИ‑искусствовед';
        modalAiButton.classList.remove('ai-btn-loading');
    }
}

function setModalIndexBySrc(imageSrc) {
    modalCurrentIndex = modalImagesList.findIndex((it) => it.path === imageSrc);
    if (modalCurrentIndex === -1) {
        // Если по какой-то причине картинки нет в списке — работаем как с одиночной
        modalImagesList = [{ path: imageSrc, name: '' }];
        modalCurrentIndex = 0;
    }
    updateModalNavButtons();
}

function navigateModal(delta) {
    if (modalImagesList.length < 2) return;
    if (modalCurrentIndex < 0) return;

    const len = modalImagesList.length;
    const nextIndex = (modalCurrentIndex + delta + len) % len;
    const item = modalImagesList[nextIndex];
    if (!item) return;

    modalCurrentIndex = nextIndex;
    setModalContent(item.path, item.name || '');
    updateModalNavButtons();
}

function openImageInNewWindowFullscreen(imageUrl, title = '', slides = [], startIndex = 0, autoStartSlideshow = false) {
    if (!imageUrl) return;
    const safeTitle = (title || '').toString().replace(/[<>]/g, '');
    const slidesSafe = Array.isArray(slides) ? slides : [];
    const initialIndex = Number.isFinite(startIndex) ? startIndex : 0;
    const shouldAutoStart = !!autoStartSlideshow;

    // Безопасно встраиваем JSON в <script> (не ломаемся на "<")
    const slidesJson = JSON.stringify(slidesSafe).replace(/</g, '\\u003c');
    const indexJson = JSON.stringify(initialIndex);
    // Создаем отдельную HTML-страницу через Blob URL (надежнее, чем document.write в about:blank с noopener)
    const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle ? safeTitle : 'Просмотр изображения'}</title>
  <style>
    html, body { height: 100%; margin: 0; background: #000; }
    body { display: grid; place-items: center; }
    img { width: 100vw; height: 100vh; object-fit: contain; display: block; }
    .tap-zone { display: none; }
    .caption {
      position: fixed;
      left: 50%;
      bottom: 14px;
      transform: translateX(-50%);
      max-width: min(920px, 96vw);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
      pointer-events: none; /* не мешает клику по изображению */
      z-index: 5;
    }
    .caption-title {
      display: inline-block;
      font: 600 18px/1.25 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: rgba(183, 184, 181, 0.96);
      background: rgba(0,0,0,0.42);
      padding: 2px 14px;
      border-radius: 14px;
      backdrop-filter: blur(6px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    }
    .caption-hint {
      display: inline-block;
      font: 13px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: rgba(201, 194, 194, 0.86);
    /* background: rgba(0,0,0,0.35); */
      padding: 0px 12px;
      border-radius: 12px;
      backdrop-filter: blur(6px);
    }
    .toolbar {
      position: fixed; top: 12px; right: 12px;
      display: flex; gap: 8px; align-items: center;
      z-index: 10;
    }
    .btn {
      font: 13px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: rgba(255,255,255,0.92);
      background: rgba(255,255,255,0.10);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 9999px;
      padding: 8px 12px;
      cursor: pointer;
      backdrop-filter: blur(8px);
    }
    .btn:hover { background: rgba(255,255,255,0.18); }\n\n    @media (max-width: 1024px) {\n      .caption-hint { display: none; }\n      .tap-zone {\n        display: block;\n        position: fixed;\n        top: 0;\n        bottom: 0;\n        width: 22vw;\n        z-index: 6;\n        -webkit-tap-highlight-color: transparent;\n      }\n      .tap-zone-left { left: 0; }\n      .tap-zone-right { right: 0; }\n    }\n\n    @media (max-width: 640px) {\n      .toolbar { top: calc(10px + env(safe-area-inset-top)); right: calc(10px + env(safe-area-inset-right)); }\n      .btn { padding: 10px 14px; font-size: 14px; }\n      .caption { bottom: calc(10px + env(safe-area-inset-bottom)); gap: 6px; }\n      .caption-title { font-size: 15px; padding: 6px 10px; border-radius: 12px; }\n    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="slideshowBtn" class="btn" type="button">Слайдшоу: Запуск</button>
  </div>
  <div id="tapPrev" class="tap-zone tap-zone-left" aria-hidden="true"></div>
  <div id="tapNext" class="tap-zone tap-zone-right" aria-hidden="true"></div>
  <img id="viewerImg" src="${imageUrl}" alt="${safeTitle}" />
  <div class="caption" aria-hidden="true" style="width: 90%;">
    <div id="captionTitle" class="caption-title">${safeTitle ? safeTitle : ''}</div>
    <div class="caption-hint">Клик по изображению — полноэкранный режим. ←/→ — предыдущая/следующая. Esc — выход.</div>
  </div>
  <script>
    const slides = ${slidesJson};
    let idx = ${indexJson};
    const autoStartSlideshow = ${JSON.stringify(shouldAutoStart)};
    const img = document.getElementById('viewerImg');       
    const btn = document.getElementById('slideshowBtn');
    const captionTitle = document.getElementById('captionTitle');
    let timer = null;

    function normalizeIndex(i) {
      const n = slides.length;
      if (!n) return 0;
      return (i % n + n) % n;
    }

    function show(i) {
      if (!slides.length) return;
      idx = normalizeIndex(i);
      const item = slides[idx];
      if (item && item.src) img.src = item.src;
      if (item && item.title) {
        document.title = item.title;
        if (captionTitle) captionTitle.textContent = item.title;
      }
    }

    async function goFullscreen() {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (e) {}
    }

    function startSlideshow() {
      if (timer) return;
      btn.textContent = 'Слайдшоу: Стоп';
      timer = setInterval(() => show(idx + 1), 6000);
    }

    function stopSlideshow() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      btn.textContent = 'Слайдшоу: Запуск';
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (timer) stopSlideshow();
      else startSlideshow();
    });

    const tapPrev = document.getElementById('tapPrev');
    const tapNext = document.getElementById('tapNext');
    const isTabletOrPhone = window.matchMedia && window.matchMedia('(max-width: 1024px)').matches;

    function canNavigate() {
      return Array.isArray(slides) && slides.length > 1;
    }

    function goPrev() { if (canNavigate()) show(idx - 1); }
    function goNext() { if (canNavigate()) show(idx + 1); }

    if (tapPrev) tapPrev.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); goPrev(); });
    if (tapNext) tapNext.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); goNext(); });

    // Свайпы (только для смартфона/планшета)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartT = 0;
    if (isTabletOrPhone) {
      img.addEventListener('touchstart', (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchStartT = Date.now();
      }, { passive: true });

      img.addEventListener('touchend', (e) => {
        if (!canNavigate()) return;
        const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
        if (!t) return;
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        const dt = Date.now() - touchStartT;
        // Горизонтальный свайп: достаточно длинный, быстрее 700мс, и доминирует над вертикальным
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 700) {
          if (dx < 0) goNext();
          else goPrev();
        }
      }, { passive: true });
    }

    img.addEventListener('click', (e) => {
      e.preventDefault();
      goFullscreen();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Закрыть вкладку, если можно (не всегда разрешено)
        try { window.close(); } catch (err) {}
        return;
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
      if (e.key.toLowerCase() === 's') { if (timer) stopSlideshow(); else startSlideshow(); }
    });

    // Инициализируем текущий кадр, если список передан
    if (slides.length) show(idx);
    if (autoStartSlideshow && slides.length > 1) startSlideshow();
  </script>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    const w = window.open(blobUrl, '_blank');
    if (!w) return;

    // Освобождаем Blob URL позже (не сразу, чтобы вкладка успела загрузиться)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

// Ссылка "Слайдшоу" в шапке страницы: открывает тот же viewer в новой вкладке.
// Стартуем с "главной" картины, а список слайдов берём из featured + загруженной галереи.
window.openSlideshowFromHeader = function openSlideshowFromHeader() {
    try {
        if (!modalImagesList || modalImagesList.length === 0) {
            rebuildModalImagesList();
        }
        // На случай, если галерея уже загрузилась после первого rebuild — перестроим ещё раз
        rebuildModalImagesList();

        const base = window.location.href;
        const slides = (modalImagesList || [])
            .map((it) => ({
                src: it && it.path ? new URL(it.path, base).href : '',
                title: it && it.name ? it.name : ''
            }))
            .filter((it) => it.src);

        if (!slides.length) return;

        const startIndex = 0;
        const first = slides[startIndex];
        openImageInNewWindowFullscreen(
            first.src,
            first.title || 'Слайдшоу',
            slides,
            startIndex,
            true
        );
    } catch (e) {
        console.warn('Не удалось открыть слайдшоу:', e);
    }
};

function openModal(imageSrc, title) {
    const modal = document.getElementById('imageModal');

    // Обновляем список, если он еще не собран
    if (!modalImagesList || modalImagesList.length === 0) {
        rebuildModalImagesList();
    }

    setModalContent(imageSrc, title);
    setModalIndexBySrc(imageSrc);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    const modalWidthWrap = document.getElementById('modal-width-wrap');
    const modalAiPanel = document.getElementById('modal-ai-panel');
    const modalAiText = document.getElementById('modal-ai-text');
    const modalAiButton = document.getElementById('modal-ai-button');
    const modalImage = document.getElementById('modalImage');
    const brightnessBtn = document.getElementById('modal-brightness-toggle');

    // Сбрасываем ИИ-панель при закрытии
    if (modalAiText) modalAiText.innerHTML = '';
    if (modalAiPanel) modalAiPanel.classList.add('hidden');
    if (modalAiButton) {
        modalAiButton.disabled = false;
        modalAiButton.textContent = 'ИИ‑искусствовед';
        modalAiButton.classList.remove('ai-btn-loading');
    }
    // Сбрасываем яркость + возвращаем исходную высоту
    if (modalImage) {
        modalImage.style.filter = '';
        modalImage.dataset.brightnessBoost = 'off';
    }
    restoreModalImageMaxHeight();
    if (brightnessBtn) {
        setBrightnessButtonState(brightnessBtn, false);
    }
    if (modalWidthWrap) {
        modalWidthWrap.style.width = '';
    }

    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

function syncModalWidthToImage() {
    const img = document.getElementById('modalImage');
    const wrap = document.getElementById('modal-width-wrap');
    if (!img || !wrap) return;
    const rect = img.getBoundingClientRect();
    if (!rect.width) return;
    // Фиксируем ширину блока под реальную ширину отображаемого изображения
    wrap.style.width = `${Math.round(rect.width)}px`;
}

// Закрытие модального окна по клавише ESC
document.addEventListener('keydown', function(event) {
    const modal = document.getElementById('imageModal');
    const isOpen = modal && !modal.classList.contains('hidden');

    if (event.key === 'Escape') {
        closeModal();
        return;
    }
    if (!isOpen) return;

    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateModal(-1);
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateModal(1);
    }
});

// Поддерживаем ширину модалки синхронно с фактической шириной картинки
document.addEventListener('DOMContentLoaded', function () {
    const img = document.getElementById('modalImage');
    if (!img) return;

    // Когда загрузилась новая картинка (или подгрузилась из кеша)
    img.addEventListener('load', function () {
        requestAnimationFrame(syncModalWidthToImage);
    });

    // При изменениях размера (resize, смена src и т.п.)
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => syncModalWidthToImage());
        ro.observe(img);
    } else {
        window.addEventListener('resize', syncModalWidthToImage);
    }
});

// Переключатель яркости в модалке (+30% / исходная)
document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('modal-brightness-toggle');
    const img = document.getElementById('modalImage');
    if (!btn || !img) return;

    btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const isOn = (img.dataset.brightnessBoost === 'on');
        if (isOn) {
            img.style.filter = '';
            img.dataset.brightnessBoost = 'off';
            setBrightnessButtonState(btn, false);
        } else {
            // Увеличиваем яркость на 30% (чуть добавим контраста, чтобы не "выжигало")
            img.style.filter = 'brightness(1.3) contrast(1.05)';
            img.dataset.brightnessBoost = 'on';
            setBrightnessButtonState(btn, true);
        }

        // Скрываем tooltip после клика, чтобы он не мешал просмотру.
        // ::after показывается по hover/focus-visible, поэтому:
        // - снимаем фокус
        // - временно подавляем tooltip даже при hover
        try { btn.blur(); } catch {}
        btn.classList.add('tooltip-suppressed');
        const clear = () => btn.classList.remove('tooltip-suppressed');
        // убираем подавление при уходе курсора
        btn.addEventListener('mouseleave', clear, { once: true });
        // и на всякий случай авто-снятие через небольшой таймер
        setTimeout(clear, 600);
    });
});

// Клик по картине в модалке -> открыть в новой вкладке на весь экран (viewer)
document.addEventListener('DOMContentLoaded', function () {
    const img = document.getElementById('modalImage');
    if (!img) return;
    img.addEventListener('click', function () {
        const titleEl = document.getElementById('modalTitle');
        const title = titleEl ? titleEl.textContent : '';
        // Передаем список изображений в viewer (абсолютные URL), чтобы работало с Blob-страницей
        const base = window.location.href;
        const slides = (modalImagesList || []).map((it) => ({
            src: it && it.path ? new URL(it.path, base).href : '',
            title: it && it.name ? it.name : ''
        })).filter((it) => it.src);
        const currentUrl = new URL(img.src, base).href;
        const startIndex = slides.findIndex((it) => it.src === currentUrl);
        openImageInNewWindowFullscreen(currentUrl, title, slides, startIndex >= 0 ? startIndex : 0);
    });
});

// --- DYNAMIC GALLERY LOADING ---
async function loadGallery() {
    try {
        const response = await fetch('/api/gallery');
        const images = await response.json();

        // Кэшируем для навигации в модалке
        galleryImagesCache = images;
        rebuildModalImagesList();
        updateModalNavButtons();
        
        const galleryContainer = document.getElementById('galleryContainer');
        
        if (images.length === 0) {
            galleryContainer.innerHTML = '<div class="text-center text-slate-400 py-8" style="grid-column: 1 / -1;">Галерея пуста</div>';
            return;
        }
        
        // Цвета для границ при наведении (RGB значения)
        const hoverColors = [
            { border: 'rgba(163, 230, 53, 0.5)', shadow: 'rgba(163, 230, 53, 0.2)' }, // lime
            { border: 'rgba(249, 115, 22, 0.5)', shadow: 'rgba(249, 115, 22, 0.2)' }, // orange
            { border: 'rgba(56, 189, 248, 0.5)', shadow: 'rgba(56, 189, 248, 0.2)' }, // sky
            { border: 'rgba(192, 132, 252, 0.5)', shadow: 'rgba(192, 132, 252, 0.2)' }, // purple
            { border: 'rgba(163, 230, 53, 0.5)', shadow: 'rgba(163, 230, 53, 0.2)' }, // lime
            { border: 'rgba(16, 185, 129, 0.5)', shadow: 'rgba(16, 185, 129, 0.2)' }, // emerald
            { border: 'rgba(56, 189, 248, 0.5)', shadow: 'rgba(56, 189, 248, 0.2)' }, // sky
            { border: 'rgba(249, 115, 22, 0.5)', shadow: 'rgba(249, 115, 22, 0.2)' }  // orange
        ];
        
        galleryContainer.innerHTML = images.map((image, index) => {
            const colors = hoverColors[index % hoverColors.length];
            
            return `
                <div class="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 transition-all duration-300 cursor-pointer group gallery-item" 
                     style="--hover-border: ${colors.border}; --hover-shadow: ${colors.shadow};"
                     onmouseenter="this.style.borderColor = 'var(--hover-border)'; this.style.boxShadow = '0 10px 15px -3px var(--hover-shadow), 0 4px 6px -2px var(--hover-shadow)';"
                     onmouseleave="this.style.borderColor = 'rgb(51, 65, 85)'; this.style.boxShadow = '';"
                     onclick="openModal('${image.path}', '${image.name}')">
                    <div class="relative overflow-hidden aspect-[4/3]">
                        <img src="${image.path}" alt="${image.name}" 
                             class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110">
                        <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div class="absolute bottom-0 left-0 right-0 p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <h4 class="font-bold text-sm">${image.name}</h4>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Убираем класс col-span-full из сообщения о загрузке, если оно есть
        const loadingMessage = galleryContainer.querySelector('.col-span-full');
        if (loadingMessage) {
            loadingMessage.remove();
        }
        
        // Обновляем состояние кнопок навигации после загрузки
        setTimeout(() => updateGalleryButtons(), 100);
        
    } catch (error) {
        console.error('Ошибка при загрузке галереи:', error);
        const galleryContainer = document.getElementById('galleryContainer');
        galleryContainer.innerHTML = '<div class="text-center text-red-400 py-8" style="grid-column: 1 / -1;">Ошибка при загрузке галереи</div>';
    }
}

// Загружаем галерею при загрузке страницы
document.addEventListener('DOMContentLoaded', loadGallery);

// --- GALLERY NAVIGATION ---
window.scrollGallery = function(direction) {
    const container = document.querySelector('.gallery-scroll-container');
    const grid = document.getElementById('galleryContainer');
    
    if (!container || !grid) {
        console.error('Галерея не найдена');
        return;
    }
    
    // Вычисляем ширину контейнера (4 картины видно)
    const containerWidth = container.offsetWidth;
    const scrollAmount = containerWidth;
    
    const currentScroll = container.scrollLeft || 0;
    const maxScroll = Math.max(0, grid.scrollWidth - containerWidth);
    
    let newScroll;
    if (direction === 'left') {
        newScroll = Math.max(0, currentScroll - scrollAmount);
    } else {
        newScroll = Math.min(maxScroll, currentScroll + scrollAmount);
    }
    
    // Плавная прокрутка
    container.scrollTo({
        left: newScroll,
        behavior: 'smooth'
    });
    
    // Обновляем состояние кнопок после прокрутки
    setTimeout(() => updateGalleryButtons(), 400);
};

window.updateGalleryButtons = function() {
    const container = document.querySelector('.gallery-scroll-container');
    const grid = document.getElementById('galleryContainer');
    
    if (!container || !grid) return;
    
    const containerWidth = container.offsetWidth;
    const currentScroll = container.scrollLeft || 0;
    const maxScroll = Math.max(0, grid.scrollWidth - containerWidth);
    
    const leftBtn = document.querySelector('.gallery-nav-left');
    const rightBtn = document.querySelector('.gallery-nav-right');
    
    if (leftBtn) {
        leftBtn.disabled = currentScroll <= 5;
        if (leftBtn.disabled) {
            leftBtn.style.opacity = '0.3';
            leftBtn.style.cursor = 'not-allowed';
        } else {
            leftBtn.style.opacity = '0.8';
            leftBtn.style.cursor = 'pointer';
        }
    }
    
    if (rightBtn) {
        rightBtn.disabled = currentScroll >= maxScroll - 10;
        if (rightBtn.disabled) {
            rightBtn.style.opacity = '0.3';
            rightBtn.style.cursor = 'not-allowed';
        } else {
            rightBtn.style.opacity = '0.8';
            rightBtn.style.cursor = 'pointer';
        }
    }
};

// Обновляем состояние кнопок при загрузке и изменении размера окна
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof updateGalleryButtons === 'function') {
            updateGalleryButtons();
        }
        window.addEventListener('resize', () => {
            setTimeout(() => {
                if (typeof updateGalleryButtons === 'function') {
                    updateGalleryButtons();
                }
            }, 100);
        });
    }, 500);
});

// Обновляем кнопки при прокрутке галереи
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.gallery-scroll-container');
    if (container) {
        container.addEventListener('scroll', () => {
            if (typeof updateGalleryButtons === 'function') {
                updateGalleryButtons();
            }
        });
    }
});

// --- UTILITY FUNCTIONS ---

// Label wrapping function for Chart.js
function wrapLabel(str, maxLen) {
    if (str.length <= maxLen) return str;
    const words = str.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        if ((currentLine + " " + words[i]).length < maxLen) {
            currentLine += " " + words[i];
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }
    lines.push(currentLine);
    return lines;
}

// Standard Tooltip Configuration
const standardTooltipConfig = {
    callbacks: {
        title: function(tooltipItems) {
            const item = tooltipItems[0];
            let label = item.chart.data.labels[item.dataIndex];
            if (Array.isArray(label)) {
                return label.join(' ');
            } else {
                return label;
            }
        }
    }
};

// Инициализация графиков после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
// Common Chart Defaults for Dark Mode
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#334155';
Chart.defaults.font.family = "'Inter', sans-serif";

// --- CHART 1: RADAR CHART (The Kuindzhi Formula) ---
const ctxRadar = document.getElementById('radarChart').getContext('2d');
new Chart(ctxRadar, {
    type: 'radar',
    data: {
        labels: [
            wrapLabel('Световая Насыщенность', 12),
            wrapLabel('Контраст Теней', 12),
            wrapLabel('Детализация', 12),
            wrapLabel('Эмоциональность', 12),
            wrapLabel('Реализм', 12)
        ],
        datasets: [{
            label: 'Архип Куинджи',
            data: [95, 90, 40, 85, 50],
            backgroundColor: 'rgba(163, 230, 53, 0.2)', // Lime low opacity
            borderColor: '#a3e635', // Lime
            pointBackgroundColor: '#a3e635',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#a3e635'
        }, {
            label: 'Типичный Передвижник',
            data: [60, 50, 90, 65, 85],
            backgroundColor: 'rgba(148, 163, 184, 0.2)', // Slate
            borderColor: '#94a3b8',
            pointBackgroundColor: '#94a3b8',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#94a3b8'
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                angleLines: { color: '#334155' },
                grid: { color: '#334155' },
                pointLabels: {
                    color: '#cbd5e1',
                    font: { size: 11 }
                },
                ticks: { display: false, backdropColor: 'transparent' }
            }
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#f8fafc' }
            },
            tooltip: standardTooltipConfig
        }
    }
});

// --- CHART 2: DOUGHNUT CHART (Themes) ---
const ctxTheme = document.getElementById('themeChart').getContext('2d');
new Chart(ctxTheme, {
    type: 'doughnut',
    data: {
        labels: [
            'Лунные ночи',
            'Солнечные закаты',
            'Дневные пейзажи (Степь)',
            'Горы и Снег',
            'Море'
        ],
        datasets: [{
            data: [35, 15, 25, 15, 10],
            backgroundColor: [
                '#a3e635', // Lime (Moon)
                '#f97316', // Orange (Sunset)
                '#22c55e', // Green (Steppe)
                '#f8fafc', // White (Snow)
                '#38bdf8'  // Blue (Sea)
            ],
            borderColor: '#1e293b',
            borderWidth: 2
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
            legend: {
                position: 'right',
                labels: { color: '#cbd5e1', boxWidth: 12 }
            },
            tooltip: standardTooltipConfig
        }
    }
});

// --- CHART 3: SCATTER PLOT (Luminosity vs Darkness) ---
const ctxScatter = document.getElementById('scatterChart').getContext('2d');

// Generate dataset
const kuindzhiPoints = [
    {x: 85, y: 90}, {x: 90, y: 95}, {x: 80, y: 85}, {x: 88, y: 92}, {x: 75, y: 80}
];
const othersPoints = [
    {x: 40, y: 50}, {x: 50, y: 60}, {x: 60, y: 55}, {x: 45, y: 45}, {x: 55, y: 65},
    {x: 30, y: 40}, {x: 65, y: 50}, {x: 50, y: 45}, {x: 35, y: 35}, {x: 70, y: 60}
];

new Chart(ctxScatter, {
    type: 'scatter',
    data: {
        datasets: [{
            label: 'Работы Куинджи',
            data: kuindzhiPoints,
            backgroundColor: '#a3e635',
            pointRadius: 6,
            pointHoverRadius: 8
        }, {
            label: 'Современники (Реализм)',
            data: othersPoints,
            backgroundColor: '#64748b',
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                title: { display: true, text: wrapLabel('Глубина Теней (Dark Value)', 20), color: '#94a3b8' },
                grid: { color: '#334155' },
                min: 0, max: 100
            },
            y: {
                title: { display: true, text: wrapLabel('Яркость Света (Light Value)', 20), color: '#94a3b8' },
                grid: { color: '#334155' },
                min: 0, max: 100
            }
        },
        plugins: {
            legend: { labels: { color: '#f8fafc' } },
            tooltip: standardTooltipConfig
        }
    }
});

// --- CHART 4: BAR CHART (Auction Prices) ---
const ctxBar = document.getElementById('barChart').getContext('2d');
const paintings = [
    'Березовая роща (1881)', 
    'Лунная ночь на Днепре (Вариант)', 
    'Закат в степи', 
    'Радуга', 
    'После дождя'
];
// Process labels
const processedLabels = paintings.map(l => wrapLabel(l, 16));

new Chart(ctxBar, {
    type: 'bar',
    data: {
        labels: processedLabels,
        datasets: [{
            label: 'Стоимость (Млн $)',
            data: [3.1, 1.8, 1.2, 0.9, 0.7], // Approximate illustrative values
            backgroundColor: [
                '#22c55e', '#a3e635', '#f97316', '#38bdf8', '#6366f1'
            ],
            borderRadius: 4
        }]
    },
    options: {
        indexAxis: 'y', // Horizontal Bar
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                grid: { color: '#334155' },
                ticks: { color: '#cbd5e1' }
            },
            y: {
                grid: { display: false },
                ticks: { color: '#f8fafc', font: { weight: 'bold' } }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: standardTooltipConfig
        }
    }
});
}); // Конец DOMContentLoaded для графиков

// --- PERPLEXITY AI INTEGRATION ---

// Ключ Perplexity приходит из server-side шаблона. Чтобы не вставлять EJS внутрь <script>
// (что ломает диагностику/линтеры в IDE), читаем его из data-атрибута <body>.
function getPerplexityApiKey() {
    // Back-compat: если где-то уже выставлен window.PERPLEXITY_API_KEY — используем его
    if (typeof window !== 'undefined' && window.PERPLEXITY_API_KEY) return window.PERPLEXITY_API_KEY;
    const raw = document?.body?.dataset?.perplexityApiKey || '';
    if (!raw) return '';
    try { return decodeURIComponent(raw); } catch { return raw; }
}

const perplexityApiKey = getPerplexityApiKey();
let aiIsLoading = false;

function renderAiMarkdownInto(element, markdownText) {
    if (!element) return;
    const raw = (markdownText ?? '').toString();

    // Если библиотеки не загрузились — показываем как обычный текст
    if (!window.marked || !window.DOMPurify) {
        element.textContent = raw;
        return;
    }

    // marked -> HTML, затем санитайзим
    const html = window.marked.parse(raw, { breaks: true, gfm: true });
    element.innerHTML = window.DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function renderAiLoadingInto(element, message = 'Генерирую ответ') {
    if (!element) return;
    // Наш контролируемый HTML — не пропускаем через marked, чтобы не было лишних зависимостей
    element.innerHTML = `
        <div class="ai-loading-row">
            <span class="ai-spinner" aria-hidden="true"></span>
            <span>${message}…</span>
        </div>
        <div class="ai-skeleton line-1"></div>
        <div class="ai-skeleton line-2"></div>
        <div class="ai-skeleton line-3"></div>
    `;
    element.setAttribute('aria-busy', 'true');
}

function clearAiBusy(element) {
    if (!element) return;
    element.removeAttribute('aria-busy');
}

async function callPerplexity(prompt) {
    if (!perplexityApiKey) {
        return "Ошибка: API ключ Perplexity не настроен. Убедитесь, что в .env есть PERPLEXITY_API_KEY (или VITE_PERPLEXITY_API_KEY) и сервер перезапущен.";
    }

    aiIsLoading = true;
    try {
        const response = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${perplexityApiKey}`,
            },
            body: JSON.stringify({
                model: "sonar",
                messages: [
                    {
                        role: "system",
                        content: "Ты — эксперт-искусствовед, специализирующийся на русской живописи XIX века и творчестве Архипа Куинджи. Отвечай кратко, профессионально и вдохновляюще. Используй русский язык."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                return "Ошибка авторизации Perplexity: проверьте правильность API ключа.";
            }
            if (response.status === 429) {
                return "Превышен лимит запросов к Perplexity API. Подождите немного или проверьте квоты/тариф в личном кабинете Perplexity.";
            }
            const errorText = await response.text().catch(() => "");
            throw new Error(`HTTP ${response.status} ${response.statusText} ${errorText}`);
        }

        const data = await response.json();
        const text =
            (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
            (data && data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) ||
            "Ответ не получен";

        return text;
    } catch (error) {
        console.error("Perplexity API error:", error);
        return `Извините, произошла ошибка при связи с ИИ (Perplexity): ${error.message}. Попробуйте позже.`;
    } finally {
        aiIsLoading = false;
    }
}

function getModalPaintingTitleForPrompt() {
    const modalTitleEl = document.getElementById('modalTitle');
    const raw = (modalTitleEl ? modalTitleEl.textContent : '') || '';
    // Убираем префикс "YYYY - " если он есть
    return raw.replace(/^\s*\d{4}\s*-\s*/u, '').trim();
}

function setModalAiLoadingState(isLoading) {
    const btn = document.getElementById('modal-ai-button');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Запрос к ИИ…' : 'ИИ‑искусствовед';
    btn.classList.toggle('ai-btn-loading', isLoading);
}

async function handleModalAiExpert() {
    // Защита от повторных кликов
    if (aiIsLoading) return;

    const panel = document.getElementById('modal-ai-panel');
    const textEl = document.getElementById('modal-ai-text');
    const paintingTitle = getModalPaintingTitleForPrompt();
    if (!panel || !textEl || !paintingTitle) return;

    setModalAiLoadingState(true);
    renderAiLoadingInto(textEl, 'Генерирую комментарий');
    panel.classList.remove('hidden');

    const prompt =
        `Дай комментарий искусствоведа о картине Архипа Куинджи «${paintingTitle}». ` +
        `Ответ дай в формате Markdown.\n\n` +
        `Структура:\n` +
        `- Короткий подзаголовок (##)\n` +
        `- 3–5 пунктов списком: что изображено/настроение, приемы (свет/цвет/контраст), композиция, контекст, интересный факт\n` +
        `- В конце 1–2 предложения-резюме\n\n` +
        `Пиши по-русски.`;

    const answer = await callPerplexity(prompt);
    renderAiMarkdownInto(textEl, answer);
    clearAiBusy(textEl);
    panel.classList.remove('hidden');
    setModalAiLoadingState(false);

    // Если ответ получен успешно — уменьшаем высоту картинки, чтобы освободить место под комментарий
    if (isPerplexityAnswerOk(answer)) {
        shrinkModalImageMaxHeightBy30Percent();
        // На всякий случай пересинхронизируем ширину после перерисовки
        try { syncModalWidthToImage(); } catch {}
    }
}

function setChatLoadingState(isLoading) {
    const askBtn = document.getElementById('ai-question-button');
    if (!askBtn) return;
    askBtn.disabled = isLoading;
    askBtn.textContent = isLoading ? 'Отправка…' : 'Отправить';
    askBtn.classList.toggle('ai-btn-loading', isLoading);
}

async function handlePageAiQuestion() {
    if (aiIsLoading) return;

    const input = document.getElementById('ai-question-input');
    const responseContainer = document.getElementById('ai-chat-response');
    if (!input || !responseContainer) return;

    const question = input.value.trim();
    if (!question) return;

    setChatLoadingState(true);
    renderAiLoadingInto(responseContainer, 'Генерирую ответ');
    responseContainer.classList.remove('hidden');

    const answer = await callPerplexity(
        `Ответь на вопрос пользователя в формате Markdown (абзацы, списки где уместно).\n\nВопрос: ${question}`
    );
    renderAiMarkdownInto(responseContainer, answer);
    clearAiBusy(responseContainer);
    responseContainer.classList.remove('hidden');
    setChatLoadingState(false);
}

// Навешиваем обработчик на кнопку модалки
document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('modal-ai-button');
    if (btn) {
        btn.addEventListener('click', handleModalAiExpert);
    }
});

// Навешиваем обработчики на кнопки пред/след в модалке
document.addEventListener('DOMContentLoaded', function () {
    const prevBtn = document.getElementById('modal-prev');
    const nextBtn = document.getElementById('modal-next');
    if (prevBtn) prevBtn.addEventListener('click', () => navigateModal(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateModal(1));
});

// Навешиваем обработчики на чат на странице
document.addEventListener('DOMContentLoaded', function () {
    const askBtn = document.getElementById('ai-question-button');
    const input = document.getElementById('ai-question-input');

    if (askBtn) {
        askBtn.addEventListener('click', handlePageAiQuestion);
    }
    if (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handlePageAiQuestion();
            }
        });
    }
});

// Аудио-пост для главной картины "Лунная ночь на Днепре"
document.addEventListener('DOMContentLoaded', function () {
    const playPauseBtn = document.getElementById('moonNightPlayPauseBtn');
    const volDownBtn = document.getElementById('moonNightVolDownBtn');
    const volUpBtn = document.getElementById('moonNightVolUpBtn');
    const audio = document.getElementById('moonNightAudio');
    if (!playPauseBtn || !audio) return;

    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function setState(isPlaying) {
        playPauseBtn.classList.toggle('is-playing', !!isPlaying);
        playPauseBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
        playPauseBtn.setAttribute('aria-label', isPlaying ? 'Пауза' : 'Воспроизвести');
        playPauseBtn.title = isPlaying ? 'Pause' : 'Play';
    }

    playPauseBtn.addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();

        try {
            if (audio.paused) {
                // Приводим громкость к умеренной по умолчанию (можно поменять при желании)
                if (typeof audio.volume !== 'number' || Number.isNaN(audio.volume)) {
                    audio.volume = 0.9;
                }
                const p = audio.play();
                // В некоторых браузерах play() возвращает Promise
                if (p && typeof p.then === 'function') await p;
                setState(true);
            } else {
                audio.pause();
                setState(false);
            }
        } catch (err) {
            console.warn('Не удалось запустить аудио (возможно, блокировка autoplay):', err);
            setState(!audio.paused);
        }
    });

    if (volDownBtn) {
        volDownBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            audio.volume = clamp((audio.volume ?? 0.9) - 0.1, 0, 1);
        });
    }

    if (volUpBtn) {
        volUpBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            audio.volume = clamp((audio.volume ?? 0.9) + 0.1, 0, 1);
        });
    }

    audio.addEventListener('ended', function () {
        setState(false);
        try { audio.currentTime = 0; } catch {}
    });
    audio.addEventListener('pause', function () {
        setState(false);
    });
    audio.addEventListener('play', function () {
        setState(true);
    });

    setState(false);
});
