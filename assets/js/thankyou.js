// Read URL params
const params = new URLSearchParams(window.location.search);
const pkg = params.get('pkg') || 'bestie_pack';

const pkgLabels = {
  starter_glow: 'Starter Glow (Buy 1)',
  bestie_pack: 'Bestie Pack (Buy 1 Take 1)',
  squad_pack: 'Squad Pack (Buy 2 Take 1)'
};
const pkgPrices = { starter_glow: '₱349', bestie_pack: '₱549', squad_pack: '₱699' };

document.getElementById('confirmPackage').textContent = pkgLabels[pkg] || pkgLabels['bestie_pack'];
document.getElementById('confirmTotal').textContent = pkgPrices[pkg] || '₱549';

// Messenger link from meta tag (set via env in TY page generation or hardcoded below)
const MESSENGER_URL = document.querySelector('meta[name="botcake:messenger_url"]')?.content || '#';
document.getElementById('messengerLink').href = MESSENGER_URL;

// Countdown and auto-redirect
let count = 3;
const countEl = document.getElementById('countdownNum');
const timer = setInterval(() => {
  count -= 1;
  countEl.textContent = count;
  if (count <= 0) {
    clearInterval(timer);
    if (MESSENGER_URL && MESSENGER_URL !== '#') {
      window.location.href = MESSENGER_URL;
    }
  }
}, 1000);
