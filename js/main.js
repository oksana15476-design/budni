/* Будни — landing interactivity: leads, analytics, reveal, FAQ, quiz, calculator, mobile nav. */
(function () {
  'use strict';

  /* =====================================================================
   * НАСТРОЙКА — заполните и заявки/аналитика заработают.
   *
   * 1) Куда отправлять заявки (достаточно одного варианта):
   *    LEAD_ENDPOINT — URL, принимающий POST с JSON (Formspree, Make,
   *    n8n, свой бэкенд): LEAD_ENDPOINT: 'https://formspree.io/f/XXXXXX'
   *    TELEGRAM — отправка сообщением в Telegram-чат через бота:
   *    TELEGRAM: { botToken: '123456:AA...', chatId: '-100123456789' }
   *    ВАЖНО: токен бота в статике виден всем — заведите отдельного
   *    бота только для приёма заявок, ничего больше ему не поручайте.
   *
   * 2) METRIKA_ID — номер счётчика Яндекс.Метрики (число). Цели на
   *    отправку форм: lead_quiz, lead_calculator, lead_contact.
   * ===================================================================== */
  var CONFIG = {
    LEAD_ENDPOINT: '',
    TELEGRAM: { botToken: '', chatId: '' },
    METRIKA_ID: null
  };

  var fmt = function (n) { return n.toLocaleString('ru-RU'); };

  /* ---------- Lead delivery ---------- */
  function leadToText(kind, data) {
    var lines = ['Новая заявка с сайта «Будни»', 'Источник: ' + kind, ''];
    Object.keys(data).forEach(function (k) {
      if (data[k]) lines.push(k + ': ' + data[k]);
    });
    lines.push('', 'Страница: ' + location.href);
    return lines.join('\n');
  }

  function submitLead(kind, data) {
    if (data.website) return; // honeypot — silently drop bot submissions
    delete data.website;

    if (window.ym && CONFIG.METRIKA_ID) {
      try { window.ym(CONFIG.METRIKA_ID, 'reachGoal', 'lead_' + kind); } catch (e) {}
    }

    if (CONFIG.LEAD_ENDPOINT) {
      fetch(CONFIG.LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ source: kind, page: location.href, fields: data }),
        keepalive: true
      }).catch(function (e) { console.warn('[lead] endpoint error', e); });
    } else if (CONFIG.TELEGRAM.botToken && CONFIG.TELEGRAM.chatId) {
      fetch('https://api.telegram.org/bot' + CONFIG.TELEGRAM.botToken + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CONFIG.TELEGRAM.chatId, text: leadToText(kind, data) }),
        keepalive: true
      }).catch(function (e) { console.warn('[lead] telegram error', e); });
    } else {
      console.info('[lead] получена заявка, но приёмник не настроен (см. CONFIG в js/main.js)', kind, data);
    }
  }

  function formData(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) { data[key] = String(value).trim(); });
    return data;
  }

  /* ---------- Yandex.Metrika ---------- */
  function initMetrika() {
    if (!CONFIG.METRIKA_ID) return;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(CONFIG.METRIKA_ID, 'init', {
      clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false
    });
  }

  /* ---------- Mobile nav ---------- */
  function initMobileNav() {
    var toggle = document.getElementById('nav-toggle');
    var panel = document.getElementById('mobile-nav');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', function () {
      var open = panel.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    panel.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        panel.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.reveal:not(.visible)'));
    if (!els.length) return;
    var pending = new Set(els);
    var show = function (el) { el.classList.add('visible'); pending.delete(el); };
    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
        });
      }, { threshold: 0.08 });
      els.forEach(function (el) { io.observe(el); });
    }
    var detach = function () {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
    var check = function () {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      pending.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < vh - 30 && r.bottom > 0) show(el);
      });
      if (!pending.size) detach();
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();
    setTimeout(check, 300);
    setTimeout(check, 1000);
  }

  /* ---------- FAQ accordion (one item open at a time) ---------- */
  function initFaq() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.faq-item'));
    items.forEach(function (item) {
      var btn = item.querySelector('.faq-q');
      btn.addEventListener('click', function () {
        var wasOpen = item.classList.contains('open');
        items.forEach(function (other) {
          other.classList.remove('open');
          other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ---------- Quiz ---------- */
  function initQuiz() {
    var card = document.getElementById('quiz-card');
    if (!card) return;
    var steps = Array.prototype.slice.call(card.querySelectorAll('[data-quiz-step]'));
    var total = steps.length;
    var barFill = document.getElementById('quiz-bar-fill');
    var stepLabel = document.getElementById('quiz-step-label');
    var flow = document.getElementById('quiz-flow');
    var success = document.getElementById('quiz-success');
    var form = document.getElementById('quiz-form');
    var current = 0;

    function showStep(n) {
      current = n;
      steps.forEach(function (s) { s.hidden = Number(s.dataset.quizStep) !== n; });
      barFill.style.width = (((n + 1) / total) * 100) + '%';
      stepLabel.textContent = 'Шаг ' + Math.min(n + 1, total) + ' из ' + total;
    }

    function summaryValue(key) {
      return card.querySelector('[data-summary-key="' + key + '"] .v');
    }

    card.querySelectorAll('.quiz-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var stepEl = btn.closest('[data-quiz-step]');
        stepEl.querySelectorAll('.quiz-option').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        var v = summaryValue(stepEl.dataset.quizKey);
        v.textContent = btn.textContent.trim();
        v.classList.remove('empty');
        setTimeout(function () { showStep(Number(stepEl.dataset.quizStep) + 1); }, 150);
      });
    });

    card.querySelectorAll('.quiz-back').forEach(function (btn) {
      btn.addEventListener('click', function () { showStep(current - 1); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = formData(form);
      card.querySelectorAll('[data-summary-key]').forEach(function (item) {
        var v = item.querySelector('.v');
        data['quiz_' + item.dataset.summaryKey] = v.classList.contains('empty') ? '' : v.textContent;
      });
      submitLead('quiz', data);
      flow.hidden = true;
      success.hidden = false;
    });

    document.getElementById('quiz-restart').addEventListener('click', function () {
      form.reset();
      card.querySelectorAll('.quiz-option.selected').forEach(function (b) { b.classList.remove('selected'); });
      card.querySelectorAll('[data-summary-key] .v').forEach(function (v) {
        v.textContent = '—';
        v.classList.add('empty');
      });
      success.hidden = true;
      flow.hidden = false;
      showStep(0);
    });

    showStep(0);
  }

  /* ---------- Calculator ---------- */
  function initCalc() {
    var card = document.getElementById('calc-card');
    if (!card) return;
    var PER = 45000;
    var mode = 'mass';
    var tabs = Array.prototype.slice.call(card.querySelectorAll('[data-calc-mode]'));
    var countInput = document.getElementById('c4-count');
    var salaryInput = document.getElementById('c4-salary');
    var countVal = document.getElementById('calc-count-val');
    var salaryVal = document.getElementById('calc-salary-val');
    var rangeMass = document.getElementById('calc-range-mass');
    var rangeTargeted = document.getElementById('calc-range-targeted');
    var priceEl = document.getElementById('calc-price');
    var linesMass = document.getElementById('calc-lines-mass');
    var linesTargeted = document.getElementById('calc-lines-targeted');
    var lineCount = document.getElementById('calc-line-count');
    var lineAnnual = document.getElementById('calc-line-annual');
    var summaryEl = document.getElementById('calc-summary');
    var cta = document.getElementById('calc-cta');
    var form = document.getElementById('calc-form');
    var main = document.getElementById('calc-main');
    var success = document.getElementById('calc-success');

    function update() {
      var count = Number(countInput.value);
      var salary = Number(salaryInput.value);
      if (mode === 'mass') {
        priceEl.textContent = 'от ' + fmt(PER * count) + ' ₽';
        countVal.textContent = count + ' чел.';
        lineCount.textContent = String(count);
        summaryEl.textContent = 'массовый подбор, ' + count + ' сотрудников, ориентир от ' + fmt(PER * count) + ' ₽';
      } else {
        var annual = salary * 12 * 1000;
        var lo = Math.round(annual * 0.12);
        var hi = Math.round(annual * 0.15);
        priceEl.textContent = fmt(lo) + ' – ' + fmt(hi) + ' ₽';
        salaryVal.textContent = fmt(salary * 1000) + ' ₽';
        lineAnnual.textContent = fmt(annual) + ' ₽';
        summaryEl.textContent = 'точечный подбор, доход ' + fmt(salary * 1000) + ' ₽/мес, ориентир ' + fmt(lo) + '–' + fmt(hi) + ' ₽';
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        mode = tab.dataset.calcMode;
        tabs.forEach(function (t) {
          t.classList.toggle('active', t === tab);
          t.setAttribute('aria-selected', String(t === tab));
        });
        rangeMass.hidden = mode !== 'mass';
        rangeTargeted.hidden = mode !== 'targeted';
        linesMass.hidden = mode !== 'mass';
        linesTargeted.hidden = mode !== 'targeted';
        form.hidden = true;
        cta.hidden = false;
        success.hidden = true;
        main.hidden = false;
        update();
      });
    });

    countInput.addEventListener('input', update);
    salaryInput.addEventListener('input', update);

    cta.addEventListener('click', function () {
      cta.hidden = true;
      form.hidden = false;
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = formData(form);
      data.summary = summaryEl.textContent;
      submitLead('calculator', data);
      main.hidden = true;
      success.hidden = false;
    });

    update();
  }

  /* ---------- Lead form ---------- */
  function initLeadForm() {
    var form = document.getElementById('lead-form');
    if (!form) return;
    var success = document.getElementById('lead-success');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitLead('contact', formData(form));
      form.hidden = true;
      success.hidden = false;
    });
    document.getElementById('lead-reset').addEventListener('click', function () {
      form.reset();
      success.hidden = true;
      form.hidden = false;
    });
  }

  initMetrika();
  initMobileNav();
  initReveal();
  initFaq();
  initQuiz();
  initCalc();
  initLeadForm();
})();
