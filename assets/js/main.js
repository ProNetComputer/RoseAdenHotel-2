/**
 * Rose Aden 2 Tourist Hotel - Core Application Script
 * فندق روز عدن 2 السياحي - سكريبت النظام والتحكم الأساسي
 */

(function () {
  'use strict';

  // State
  let currentTheme = localStorage.getItem('rose_theme') || 'dark';
  let currentLang = localStorage.getItem('rose_lang') || 'ar';

  // Apply Theme
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

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentTheme);
  });
})();