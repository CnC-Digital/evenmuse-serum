// ── Package data ──
const PACKAGES = {
  starter_glow: {
    label: 'Starter Glow — Buy 1 (30mL)',
    price: 349,
    priceLabel: '₱349',
    qty: '×1',
    freeRow: false
  },
  bestie_pack: {
    label: 'Bestie Pack — Buy 1 Take 1',
    price: 549,
    priceLabel: '₱549',
    qty: '×2',
    freeRow: true,
    freeLabel: 'Extra bottle (FREE)'
  },
  squad_pack: {
    label: 'Squad Pack — Buy 2 Take 1',
    price: 699,
    priceLabel: '₱699',
    qty: '×3',
    freeRow: true,
    freeLabel: '1 bottle FREE (squad bonus)'
  }
};

// ── 15-min Countdown ──
let _cdEnd = null;
let _cdTimer = null;

function startCountdown() {
  if (_cdEnd) return; // keep running across re-opens
  _cdEnd = Date.now() + 15 * 60 * 1000;
  function tick() {
    const rem = Math.max(0, _cdEnd - Date.now());
    const m = Math.floor(rem / 60000);
    const s = Math.floor((rem % 60000) / 1000);
    document.getElementById('cd-minutes').textContent = String(m).padStart(2, '0');
    document.getElementById('cd-seconds').textContent = String(s).padStart(2, '0');
    if (rem > 0) _cdTimer = setTimeout(tick, 1000);
  }
  tick();
}

function scrollToPackages() {
  const section = document.getElementById('choose-package');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function openPopup(packageName) {
  const pkg = PACKAGES[packageName] || PACKAGES['bestie_pack'];
  document.getElementById('selectedPackage').value = packageName;

  document.getElementById('summaryProduct').textContent = pkg.label;
  document.getElementById('summaryQty').textContent = pkg.qty;
  document.getElementById('summaryTotal').textContent = pkg.priceLabel;
  document.getElementById('codAmount').textContent = pkg.priceLabel;

  const freeRow = document.getElementById('summaryFreeRow');
  if (pkg.freeRow) {
    freeRow.style.display = 'flex';
    document.getElementById('summaryFreeLabel').textContent = pkg.freeLabel;
  } else {
    freeRow.style.display = 'none';
  }

  document.getElementById('checkoutOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  startCountdown();

  // FB Pixel: InitiateCheckout
  if (typeof fbq !== 'undefined') {
    fbq('track', 'InitiateCheckout', {
      content_name: pkg.label,
      currency: 'PHP',
      value: pkg.price,
      num_items: parseInt(pkg.qty.replace('×', ''))
    });
  }
}

function closePopup() {
  document.getElementById('checkoutOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('checkoutOverlay')) closePopup();
}

// ── Form submission ──
async function submitOrder(e) {
  e.preventDefault();

  const codConfirm = document.getElementById('codConfirm');
  if (!codConfirm.checked) {
    showError('Please confirm the COD payment before proceeding.');
    return;
  }

  const phone = document.getElementById('phone').value.trim();
  if (!/^(09|\+639|639)\d{9}$/.test(phone)) {
    showError('Please enter a valid PH mobile number (e.g. 09171234567 or +639171234567).');
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Sending your order…';

  const formData = new FormData(document.getElementById('orderForm'));
  const payload = Object.fromEntries(formData.entries());

  // Generate client-side event ID for dedup
  const eventId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);

  try {
    const res = await fetch('/api/submit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, clientEventId: eventId })
    });

    const data = await res.json();

    if (data.success) {
      const pkg = PACKAGES[payload.packageName] || PACKAGES['bestie_pack'];

      // FB Pixel: Purchase (client-side, deduped via event_id)
      if (typeof fbq !== 'undefined') {
        fbq('track', 'Purchase', {
          value: pkg.price,
          currency: 'PHP',
          content_name: pkg.label,
          eventID: data.eventId
        });
      }

      // Redirect
      window.location.href = data.redirect || '/thankyou.html';
    } else {
      showError(data.error || 'Error submitting order. Please try again.');
      btn.disabled = false;
      btn.textContent = 'ORDER NOW — PAY ON DELIVERY';
    }
  } catch (err) {
    showError('Cannot connect to server. Please check your internet connection.');
    btn.disabled = false;
    btn.textContent = 'ORDER NOW — PAY ON DELIVERY';
  }
}

function showError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.style.display = 'block';
}

// ── PH Location Dropdowns (via Pancake geo proxy) ──
const GEO = '/api/pancake-geo';

function _setLoading(selectEl, msg) {
  selectEl.innerHTML = `<option value="">${msg}</option>`;
  selectEl.disabled = true;
}
function _setReady(selectEl, placeholder) {
  selectEl.disabled = false;
  if (selectEl.options.length <= 1) {
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  }
}
function _resetSelect(selectEl, placeholder) {
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  selectEl.disabled = false;
}

async function populateCities() {
  const provinceEl = document.getElementById('province');
  const citySelect = document.getElementById('city');
  const barangaySelect = document.getElementById('barangay');
  const provinceId = provinceEl.selectedOptions[0]?.dataset.pancakeId;

  // Reset downstream + hidden IDs
  _resetSelect(citySelect, '— Select City —');
  _resetSelect(barangaySelect, '— Select Barangay —');
  document.getElementById('provinceId').value = provinceId || '';
  document.getElementById('districtId').value = '';
  document.getElementById('communeId').value = '';

  if (!provinceId) return;

  _setLoading(citySelect, '— Loading cities… —');
  try {
    const data = await fetch(`${GEO}?type=districts&province_id=${encodeURIComponent(provinceId)}`).then(r => r.json());
    citySelect.innerHTML = '<option value="">— Select City —</option>';
    data.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.dataset.pancakeId = c.id;
      opt.textContent = c.name;
      citySelect.appendChild(opt);
    });
    citySelect.disabled = false;
  } catch {
    _setReady(citySelect, '— Select City —');
  }
}

async function populateBarangays() {
  const cityEl = document.getElementById('city');
  const barangaySelect = document.getElementById('barangay');
  const districtId = cityEl.selectedOptions[0]?.dataset.pancakeId;

  _resetSelect(barangaySelect, '— Select Barangay —');
  document.getElementById('districtId').value = districtId || '';
  document.getElementById('communeId').value = '';

  if (!districtId) return;

  _setLoading(barangaySelect, '— Loading barangays… —');
  try {
    const data = await fetch(`${GEO}?type=communes&district_id=${encodeURIComponent(districtId)}`).then(r => r.json());
    barangaySelect.innerHTML = '<option value="">— Select Barangay —</option>';
    data.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.name;
      opt.dataset.pancakeId = b.id;
      opt.textContent = b.name;
      barangaySelect.appendChild(opt);
    });
    barangaySelect.disabled = false;
  } catch {
    _setReady(barangaySelect, '— Select Barangay —');
  }
}

document.getElementById('barangay').addEventListener('change', function () {
  document.getElementById('communeId').value = this.selectedOptions[0]?.dataset.pancakeId || '';
});

// Populate province dropdown on init
(async function initProvinces() {
  const provinceSelect = document.getElementById('province');
  _setLoading(provinceSelect, '— Loading provinces… —');
  try {
    const data = await fetch(`${GEO}?type=provinces`).then(r => r.json());
    provinceSelect.innerHTML = '<option value="">— Select Province —</option>';
    data.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.dataset.pancakeId = p.id;
      opt.textContent = p.name;
      provinceSelect.appendChild(opt);
    });
    provinceSelect.disabled = false;
  } catch {
    provinceSelect.innerHTML = '<option value="">— Select Province —</option>';
    provinceSelect.disabled = false;
  }
})();

// ── Phone input: digits only, max length based on prefix ──
document.getElementById('phone').addEventListener('input', function () {
  // Strip non-digit chars except leading +
  let val = this.value.replace(/[^\d+]/g, '');

  // Allow + only at position 0
  if (val.indexOf('+') > 0) val = val.replace(/\+/g, '');

  // Determine max length: +639xxxxxxxxx = 13, 639xxxxxxxxx = 12, 09xxxxxxxxx = 11
  let max = 11;
  if (val.startsWith('+639')) max = 13;
  else if (val.startsWith('639')) max = 12;

  if (val.length > max) val = val.slice(0, max);

  this.value = val;
});

// ── Fade-in on scroll ──
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
