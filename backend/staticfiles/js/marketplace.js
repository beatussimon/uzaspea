document.addEventListener('DOMContentLoaded', function() {
    // --- Infinite Scroll ---
    let loading = false;
    let page = 2; // Start with page 2 (page 1 is already loaded)
    const productContainer = document.getElementById('product-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    let noMoreProducts = false;

    function loadMoreProducts() {
        if (loading || noMoreProducts) return;  // Prevent multiple simultaneous loads
        loading = true;
        loadingIndicator.style.display = 'block';

        // Construct the URL with current filters + the next page
        let url = new URL(window.location.href);
        url.searchParams.set('page', page);


        fetch(url, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest', // Important for AJAX detection
            }
        })
        .then(response => {
            if (!response.ok) {
              if (response.status === 404) {
                noMoreProducts = true;
                throw new Error('No more products');
              } else {
                throw new Error('Network response was not ok');
              }
            }
            return response.text(); // Get the response as text
        })
        .then(data => {
            // *Append* the new HTML to the container
            productContainer.insertAdjacentHTML('beforeend', data);
            page++; // Increment page number
        })
        .catch(error => {
            console.error('Error:', error);
             if (error.message === 'No more products'){
                loadingIndicator.style.display = 'none'; // Hide indicator.
             }
        })
        .finally(() => {
            loading = false;
            loadingIndicator.style.display = 'none';
        });
    }

    window.addEventListener('scroll', function() {
        // Check if the user has scrolled to the bottom of the page.
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50) {  // 50px threshold
            loadMoreProducts();
        }
    });


    // --- Add to Cart (AJAX) ---
    const addToCartForms = document.querySelectorAll('.add-to-cart-form'); //Correct class

    addToCartForms.forEach(form => {
        form.addEventListener('submit', function(event) {
            event.preventDefault();

            const formData = new FormData(this);
            const url = this.action;
            const method = this.method;

            fetch(url, {
                method: method,
                body: formData,
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                    'X-Requested-With': 'XMLHttpRequest' // Add this for AJAX detection
                }
            })
            .then(response => {
                if (!response.ok) {
                  throw new Error('Network response was not ok'); // More robust error
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Update cart display (e.g., badge count)
                    const cartCountElement = document.querySelector('.fa-shopping-cart + .badge'); // Locate badge
                    if (cartCountElement) {
                        cartCountElement.textContent = data.cart_count; // Update count
                    }
                    // Display a *good* success message (using Bootstrap alerts)
                    displayMessage(data.message, 'success');

                } else {
                  displayMessage(data.message, 'warning'); // Use consistent messaging
                }
            })
            .catch(error => {
                console.error('Error:', error);
                displayMessage('An error occurred. Please try again.', 'danger');
            });
        });
    });

    // --- Helper Functions ---

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    function displayMessage(message, type) {
        // Create a Bootstrap alert element
        const alertDiv = document.createElement('div');
        alertDiv.classList.add('alert', `alert-${type}`, 'alert-dismissible', 'fade', 'show');
        alertDiv.setAttribute('role', 'alert');
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        // Find the container where you want to display messages (e.g., top of the page)
        const container = document.querySelector('.container.mt-4'); // Consistent with base.html
        container.prepend(alertDiv);  // Add the alert to the container


        // Automatically hide the alert after a few seconds (optional)
        setTimeout(() => {
            alertDiv.remove();
        }, 5000); // 5 seconds
    }
});