// NOTE: avoid redeclaring 'params' and 'pkg' — already declared as const in the inline <head> script
const tyParams  = new URLSearchParams(window.location.search);
const tyPkg     = tyParams.get('pkg')   || 'bestie_pack';
const tyName    = tyParams.get('name')  || '';
const tyPrice   = tyParams.get('price') || '';
const tyPhone   = tyParams.get('phone') || '';
const tyAddr    = tyParams.get('addr')  || '';

const TY_PACKAGES = {
  starter_glow: {
    label: 'Starter Glow — Buy 1 (30mL)',
    price: '₱349',
    items: ['1× EvenMuse Alpha Arbutin Serum (30mL)'],
  },
  bestie_pack: {
    label: 'Bestie Pack — Buy 1 Take 1',
    price: '₱549',
    items: ['2× EvenMuse Alpha Arbutin Serum (30mL each)', '1 extra bottle FREE'],
  },
  squad_pack: {
    label: 'Squad Pack — Buy 2 Take 1',
    price: '₱699',
    items: ['3× EvenMuse Alpha Arbutin Serum (30mL each)', '1 bottle FREE — biggest saving!'],
  },
};

const tySelected     = TY_PACKAGES[tyPkg] || TY_PACKAGES['bestie_pack'];
const tyDisplayPrice = tyPrice ? `₱${tyPrice}` : tySelected.price;

// ── Populate order summary ──
document.getElementById('confirmPackage').textContent = tySelected.label;
document.getElementById('confirmTotal').textContent   = tyDisplayPrice;

if (tyName) {
  document.getElementById('confirmName').textContent = tyName.split(' ')[0];
}

if (tyAddr) {
  document.getElementById('confirmAddress').textContent  = tyAddr;
  document.getElementById('confirmAddressRow').style.display = 'flex';
}

// ── "What you'll receive" section ──
const bonusesEl = document.querySelector('.bonuses');
if (bonusesEl) {
  bonusesEl.innerHTML = `
    <div class="bonuses-title">What you'll receive</div>
    ${tySelected.items.map(item => `
      <div class="bonus-row"><span class="icon">📦</span><span>${item}</span></div>
    `).join('')}
    <div class="bonus-row"><span class="icon">💵</span><span>Total to pay on delivery: <strong>${tyDisplayPrice}</strong></span></div>
    <div class="bonus-row"><span class="icon">🚚</span><span>Free shipping via J&amp;T Express</span></div>
  `;
}

// ── Botcake ref URL ──
const BOTCAKE_URL = document.querySelector('meta[name="botcake:ref_url"]')?.content
  || 'https://m.me/1049930684865708?ref=2539956';

document.getElementById('messengerLink').href = BOTCAKE_URL;

// ── Countdown display (no redirect — user stays on TY page) ──
const countEl = document.getElementById('countdownNum');
if (countEl) {
  const redirectCard = document.querySelector('.redirect-card');
  if (redirectCard) redirectCard.style.display = 'none'; // hide the redirect card since we don't auto-redirect
}
