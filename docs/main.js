// Tab switching for install section
function showTab(name) {
  document.querySelectorAll('.install-block').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const block = document.getElementById('tab-' + name);
  if (block) block.classList.add('active');
  event.target.classList.add('active');
}

// Copy button
function copy(btn) {
  const code = btn.parentElement.querySelector('code');
  if (!code) return;
  navigator.clipboard.writeText(code.textContent.trim()).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'copied!';
    btn.style.color = 'var(--green)';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1500);
  });
}

// Sidebar active link on scroll (docs pages)
const sections = document.querySelectorAll('h2[id], h3[id]');
const sidebarLinks = document.querySelectorAll('.sidebar-link');

if (sections.length && sidebarLinks.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        sidebarLinks.forEach(link => link.classList.remove('active'));
        const active = document.querySelector(`.sidebar-link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-60px 0px -70% 0px' });

  sections.forEach(s => observer.observe(s));
}
