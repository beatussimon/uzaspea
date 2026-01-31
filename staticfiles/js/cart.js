// static/js/cart.js
function showAlert(message, type = 'success') {
    const alert = document.createElement('div');
    alert.classList.add('alert', `alert-${type}`, 'alert-dismissible', 'fade', 'show');
    alert.setAttribute('role', 'alert');
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.zIndex = '1050';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 3000);
}

function updateCartCount(count) {
    const badge = document.querySelector('.cart-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

// Initialize cart badge visibility on page load
document.addEventListener('DOMContentLoaded', function() {
    const badge = document.querySelector('.cart-badge');
    if (badge) {
        const initialCount = parseInt(badge.dataset.cartCount) || 0;
        updateCartCount(initialCount);
    }
});