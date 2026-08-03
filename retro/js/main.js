// ========== Nav scroll spy ==========
const sections = ['about', 'services', 'team', 'faq', 'access', 'contact']
  .map(id => document.getElementById(id))
  .filter(Boolean);
const navLinks = [...document.querySelectorAll('#nav a')];

function onScroll() {
  const y = window.scrollY + 140;
  let active = null;
  sections.forEach(s => { if (s.offsetTop <= y) active = s.id; });
  navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + active));
}
document.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ========== Mobile drawer ==========
const menuBtn = document.getElementById('menu-btn');
const drawer = document.getElementById('drawer');
if (menuBtn && drawer) {
  menuBtn.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  drawer.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      document.body.classList.remove('menu-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

// ========== Contact form (Google Apps Script) ==========
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('button[type="submit"]');
    const origHTML = btn.innerHTML;
    btn.innerHTML = '送信中...';
    btn.disabled = true;

    try {
      const res = await fetch(contactForm.action, {
        method: 'POST',
        body: new URLSearchParams(new FormData(contactForm))
      });
      const json = await res.json();

      if (json.result === 'success') {
        contactForm.innerHTML =
          '<div class="form-done">' +
            '<div class="mark">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
                '<path d="M5 13l4 4L19 7"/>' +
              '</svg>' +
            '</div>' +
            '<h4>送信が完了しました</h4>' +
            '<p>お問い合わせありがとうございます。<br>3営業日以内にご連絡いたします。</p>' +
          '</div>';
      } else {
        throw new Error(json.error || '送信エラー');
      }
    } catch (err) {
      btn.innerHTML = origHTML;
      btn.disabled = false;
      alert('送信に失敗しました。お手数ですがお電話（0573-65-5054）でお問い合わせください。');
    }
  });
}
