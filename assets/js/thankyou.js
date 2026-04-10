// Read URL params
const params = new URLSearchParams(window.location.search);
const pkg = params.get('pkg') || 'bestie_pack';

const PACKAGES = {
  starter_glow: {
    label: 'Starter Glow (Buy 1)',
    price: '₱349',
    receive: ['1× EvenMuse Alpha Arbutin Serum (30mL)'],
  },
  bestie_pack: {
    label: 'Bestie Pack (Buy 1 Take 1)',
    price: '₱549',
    receive: ['2× EvenMuse Alpha Arbutin Serum (30mL each)', '1 bottle FREE — share with a friend!'],
  },
  squad_pack: {
    label: 'Squad Pack (Buy 2 Take 1)',
    price: '₱699',
    receive: ['3× EvenMuse Alpha Arbutin Serum (30mL each)', '1 bottle FREE — biggest saving!'],
  },
};

const selected = PACKAGES[pkg] || PACKAGES['bestie_pack'];

document.getElementById('confirmPackage').textContent = selected.label;
document.getElementById('confirmTotal').textContent = selected.price;

// Dynamic "What you'll receive" list
const bonusesEl = document.querySelector('.bonuses');
if (bonusesEl) {
  bonusesEl.innerHTML = `
    <div class="bonuses-title">What you'll receive</div>
    ${selected.receive.map(item => `
      <div class="bonus-row"><span class="icon">📦</span><span>${item}</span></div>
    `).join('')}
    <div class="bonus-row"><span class="icon">🚚</span><span>Free shipping via J&amp;T Express — pay upon delivery</span></div>
  `;
}

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
