/* 赛博判官报告页 · 渐进增强脚本
   无 JS 时：正文、目录锚点、证据锚点、折叠与方法说明均可读可用。
   有 JS 时：增加阅读进度、目录当前位置、证据跳转后的返回按钮。
*/
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 阅读进度 ---------- */
  var spine = doc.querySelector('.spine');
  var topbar = doc.querySelector('.topbar');

  function setProgress() {
    var max = root.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
    var v = p.toFixed(2) + '%';
    if (spine) spine.style.setProperty('--progress', v);
    if (topbar) topbar.style.setProperty('--progress', v);
  }

  /* ---------- 目录当前位置 ---------- */
  var sections = Array.prototype.slice.call(doc.querySelectorAll('section[data-nav]'));
  var links = Array.prototype.slice.call(doc.querySelectorAll('a[data-nav]'));
  var currentId = null;

  function setCurrent() {
    if (!sections.length) return;
    var line = window.innerHeight * 0.32;
    var cur = sections[0].id;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= line) cur = sections[i].id;
    }
    if (cur === currentId) return;
    currentId = cur;
    links.forEach(function (a) {
      if (a.getAttribute('data-nav') === cur) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      setProgress();
      setCurrent();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  setProgress();
  setCurrent();

  /* ---------- 证据跳转后的返回按钮 ---------- */
  var pill = doc.querySelector('.back-pill');
  var lastY = null;
  var lastCite = null;

  doc.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a.cite') : null;
    if (!a || !pill) return;
    lastCite = a;
    lastY = window.scrollY;
    window.setTimeout(function () {
      if (lastY === null) return;
      pill.setAttribute('data-show', '');
    }, 40);
  });

  if (pill) {
    pill.addEventListener('click', function () {
      var y = lastY === null ? 0 : lastY;
      pill.removeAttribute('data-show');
      lastY = null;
      window.scrollTo({ top: Math.max(0, y - 24), behavior: 'auto' });
      if (lastCite) lastCite.focus({ preventScroll: true });
    });
  }

  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (pill && pill.hasAttribute('data-show')) {
        pill.removeAttribute('data-show');
        lastY = null;
      }
      if (toc && (toc.classList.contains('open') || location.hash === '#toc-panel')) {
        closeToc();
        if (tocBtn) tocBtn.focus();
      }
    }
  });

  /* ---------- 移动端目录面板 ---------- */
  var toc = doc.querySelector('.toc-panel');
  var tocBtn = doc.querySelector('.toc-btn');

  function closeToc() {
    if (toc) toc.classList.remove('open');
    if (tocBtn) tocBtn.setAttribute('aria-expanded', 'false');
    if (location.hash === '#toc-panel') history.replaceState(null, '', location.pathname + location.search);
  }

  if (tocBtn && toc) {
    tocBtn.setAttribute('aria-expanded', location.hash === '#toc-panel' ? 'true' : 'false');
    tocBtn.addEventListener('click', function (e) {
      e.preventDefault();
      toc.classList.add('open');
      tocBtn.setAttribute('aria-expanded', 'true');
      var close = toc.querySelector('.toc-close');
      if (close) close.focus();
    });
    toc.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      if (a.classList.contains('toc-close')) {
        e.preventDefault();
        if (location.hash === '#toc-panel') history.pushState(null, '', location.pathname + location.search);
        tocBtn.focus();
      }
      closeToc();
    });
    doc.addEventListener('click', function (e) {
      if (!toc.classList.contains('open')) return;
      if (toc.contains(e.target) || tocBtn.contains(e.target)) return;
      closeToc();
    });
  }

  /* ---------- 目录跳转：柔和滚动，保留地址栏锚点 ---------- */
  doc.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-nav]') : null;
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) !== '#') return;
    var el = doc.querySelector(href);
    if (!el) return;
    e.preventDefault();
    var bar = window.innerWidth <= 1020 ? 64 : 12;
    var top = el.getBoundingClientRect().top + window.scrollY - bar;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
    closeToc();
    if (history.pushState) history.pushState(null, '', href);
    var heading = el.querySelector('h2') || el;
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  });

  /* ---------- 打印：展开全部折叠区 ---------- */
  var printState = [];
  window.addEventListener('beforeprint', function () {
    printState = Array.prototype.map.call(doc.querySelectorAll('details'), function (d) {
      var state = [d, d.open]; d.open = true; return state;
    });
  });
  window.addEventListener('afterprint', function () {
    printState.forEach(function (state) { state[0].open = state[1]; });
    printState = [];
  });
})();
