/**
 * Rose Aden 2 Tourist Hotel - Core Application Script
 * فندق روز عدن 2 السياحي - سكريبت النظام والتحكم الأساسي
 */

(function () {
  'use strict';

  // State
  let currentTheme = localStorage.getItem('rose_theme') || 'dark';
  let currentLang = localStorage.getItem('rose_lang') || 'ar';

  // Apply Theme Mode (Dark / Light)
  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rose_theme', theme);

    const icon = document.getElementById('themeBtnIcon');
    const text = document.getElementById('themeBtnText');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (text) {
      if (currentLang === 'ar') {
        text.textContent = theme === 'dark' ? 'النهاري' : 'الليلي';
      } else {
        text.textContent = theme === 'dark' ? 'Light' : 'Dark';
      }
    }
  }

  // Toggle Theme
  window.toggleTheme = function () {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  };

  // Mobile Navigation Drawer
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      const isOpen = navLinks.classList.contains('open');
      mobileToggle.innerHTML = isOpen ? '&times;' : '&#9776;';
    });
  }

  // Header Scroll Effect
  const header = document.querySelector('.main-header');
  window.addEventListener('scroll', () => {
    if (header) {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  });

  // Dynamic Theme & Customizer Loader from data/theme.json
  async function loadDynamicThemeConfig() {
    try {
      const isSub = window.location.pathname.includes('/admin/');
      const jsonPath = isSub ? '../data/theme.json' : 'data/theme.json';

      const res = await fetch(jsonPath);
      if (res.ok) {
        const cfg = await res.json();
        const root = document.documentElement;

        if (cfg.rose_primary) {
          root.style.setProperty('--rose-primary', cfg.rose_primary);
        }
        if (cfg.rose_dark) {
          root.style.setProperty('--rose-dark', cfg.rose_dark);
        }
        if (cfg.luxury_gold) {
          root.style.setProperty('--luxury-gold', cfg.luxury_gold);
        }
        if (cfg.luxury_gold_light) {
          root.style.setProperty('--luxury-gold-light', cfg.luxury_gold_light);
        }
        if (cfg.font_arabic) {
          root.style.setProperty('--font-arabic', cfg.font_arabic);
        }
        if (cfg.border_radius) {
          root.style.setProperty('--radius-lg', cfg.border_radius);
        }

        // Announcement Bar
        if (cfg.announcement && cfg.announcement.enabled && !document.getElementById('promoBanner')) {
          renderAnnouncementBanner(cfg.announcement);
        }
      }
    } catch (e) {
      // fallback to default stylesheet values
    }
  }

  function renderAnnouncementBanner(ann) {
    const banner = document.createElement('div');
    banner.id = 'promoBanner';
    banner.style.cssText = 'background: linear-gradient(90deg, var(--rose-dark) 0%, var(--rose-primary) 50%, var(--luxury-gold) 100%); color: #ffffff; padding: 0.55rem 1rem; text-align: center; font-size: 0.88rem; font-weight: 700; display: flex; justify-content: center; align-items: center; gap: 1rem; flex-wrap: wrap; box-shadow: 0 2px 8px rgba(0,0,0,0.25); position: relative; z-index: 1001;';

    banner.innerHTML = '<span>' + (ann.text_ar || '') + '</span>' +
      (ann.link ? '<a href="' + ann.link + '" target="_blank" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.4); color: #fff; padding: 0.2rem 0.75rem; border-radius: 99px; text-decoration: none; font-size: 0.8rem;">' + (ann.btn_text || 'التفاصيل') + '</a>' : '') +
      '<button onclick="this.parentElement.remove()" style="background:none; border:none; color:#fff; font-size:1.1rem; cursor:pointer; line-height:1; margin-right: 0.5rem;" title="إغلاق">&times;</button>';

    document.body.prepend(banner);
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    initHeroRandomCarousel();
    applyTheme(currentTheme);
    loadDynamicThemeConfig();
  });

  // ==========================================
  

  // ==============================================================
  // Smart Randomized Hero Gallery Carousel Controller
  // محرك السلايدر العشوائي التلقائي لجميع محتويات المعرض
  // ==============================================================
  async function initHeroRandomCarousel() {
    const track = document.getElementById('heroCarouselTrack');
    const dotsContainer = document.getElementById('heroCarouselDots');
    const prevBtn = document.getElementById('carPrevBtn');
    const nextBtn = document.getElementById('carNextBtn');
    const box = document.getElementById('heroCarouselBox');
    const titleEl = document.getElementById('carouselActiveTitle');
    const counterEl = document.getElementById('carouselActiveCounter');
    const categoryPill = document.getElementById('carouselCategoryPill');
    const progressFill = document.getElementById('carouselProgressFill');

    if (!track) return;

    let items = [];
    let currentIndex = 0;
    let autoPlayTimer = null;
    let progressTimer = null;
    const slideDuration = 4000; // 4 seconds per slide
    const progressInterval = 50;

    const categoryArabicNames = {
      'exterior': '🏛️ الواجهة والمبنى الخارجي',
      'rooms': '🛏️ الغرف والأجنحة الفندقية',
      'vip': '👑 طيرمانات وأجنحة VIP الملكية',
      'halls': '🎓 قاعات التدريب والفعاليات والوجبات',
      'lobby': '🛎️ صالة الاستقبال واللوبي الفاخر'
    };

    // 1. Fetch gallery items
    try {
      const res = await fetch('data/gallery.json');
      if (res.ok) {
        items = await res.json();
      }
    } catch (e) {
      console.warn('Could not load gallery.json:', e);
    }

    if (!items || items.length === 0) return;

    // 2. Fisher-Yates Shuffle for true random order on each page visit
    items = shuffleArray([...items]);

    // 3. Render Slides in Track
    track.innerHTML = items.map((slide, idx) => `
      <div class="hero-car-slide ${idx === 0 ? 'active' : ''}">
        <img src="${slide.src}" alt="${slide.title || 'فندق روز عدن 2'}" loading="${idx === 0 ? 'eager' : 'lazy'}" onerror="this.src='assets/images/building-day.jpg'">
        <div class="hero-slide-overlay">
          <div class="hero-slide-caption">
            <!-- Overlay caption for high-contrast mobile view -->
          </div>
        </div>
      </div>
    `).join('');

    // 4. Render Dots
    if (dotsContainer) {
      dotsContainer.innerHTML = items.map((_, idx) => `
        <button class="hero-car-dot ${idx === 0 ? 'active' : ''}" data-idx="${idx}" aria-label="صورة ${idx + 1}"></button>
      `).join('');

      dotsContainer.querySelectorAll('.hero-car-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'), 10);
          goToSlide(idx);
          resetAutoPlay();
        });
      });
    }

    const slideEls = track.querySelectorAll('.hero-car-slide');

    // 5. Update Carousel View
    function updateCarousel() {
      const isRtl = document.documentElement.dir === 'rtl';
      const offset = currentIndex * 100;
      track.style.transform = isRtl ? `translateX(${offset}%)` : `translateX(-${offset}%)`;

      // Active slide styling
      slideEls.forEach((s, idx) => {
        if (idx === currentIndex) s.classList.add('active');
        else s.classList.remove('active');
      });

      // Update active text and badge
      const curItem = items[currentIndex];
      if (curItem) {
        if (titleEl) titleEl.textContent = curItem.title || 'فندق روز عدن 2';
        if (categoryPill) categoryPill.textContent = categoryArabicNames[curItem.category] || 'لقطة مميزة';
        if (counterEl) counterEl.textContent = `لقطة رقم ${currentIndex + 1} من إجمالي ${items.length} صور في المعرض`;
      }

      // Update dots
      if (dotsContainer) {
        const dots = dotsContainer.querySelectorAll('.hero-car-dot');
        dots.forEach((d, idx) => {
          if (idx === currentIndex) d.classList.add('active');
          else d.classList.remove('active');
        });
      }
    }

    function goToSlide(index) {
      if (index >= items.length) currentIndex = 0;
      else if (index < 0) currentIndex = items.length - 1;
      else currentIndex = index;
      updateCarousel();
    }

    function nextSlide() {
      goToSlide(currentIndex + 1);
    }

    function prevSlide() {
      goToSlide(currentIndex - 1);
    }

    if (prevBtn) {
      prevBtn.onclick = () => {
        prevSlide();
        resetAutoPlay();
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        nextSlide();
        resetAutoPlay();
      };
    }

    // Progress Bar Animation
    let progressElapsed = 0;
    function startProgress() {
      progressElapsed = 0;
      if (progressFill) progressFill.style.width = '0%';
      clearInterval(progressTimer);
      progressTimer = setInterval(() => {
        progressElapsed += progressInterval;
        const pct = Math.min(100, (progressElapsed / slideDuration) * 100);
        if (progressFill) progressFill.style.width = `${pct}%`;
      }, progressInterval);
    }

    function startAutoPlay() {
      startProgress();
      clearInterval(autoPlayTimer);
      autoPlayTimer = setInterval(() => {
        nextSlide();
        startProgress();
      }, slideDuration);
    }

    function stopAutoPlay() {
      clearInterval(autoPlayTimer);
      clearInterval(progressTimer);
    }

    function resetAutoPlay() {
      stopAutoPlay();
      startAutoPlay();
    }

    if (box) {
      box.addEventListener('mouseenter', stopAutoPlay);
      box.addEventListener('mouseleave', startAutoPlay);

      // Touch Swipe
      let touchStartX = 0;
      let touchEndX = 0;

      box.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoPlay();
      }, { passive: true });

      box.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if (Math.abs(diff) > 40) {
          const isRtl = document.documentElement.dir === 'rtl';
          if (diff > 0) {
            if (isRtl) nextSlide();
            else prevSlide();
          } else {
            if (isRtl) prevSlide();
            else nextSlide();
          }
        }
        startAutoPlay();
      }, { passive: true });
    }

    // Helper: Fisher-Yates shuffle
    function shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    // Initialize first view and start
    updateCarousel();
    startAutoPlay();
  }

})();