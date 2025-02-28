from django.shortcuts import render, get_object_or_404, redirect
from .models import Product, Category, Review, Order, OrderItem, UserProfile, ProductImage, SidebarOffer, SidebarNewsItem, Subscription
from .forms import ProductForm, ReviewForm, UserRegistrationForm, ProductImageFormSet, ReplyForm, SubscriptionForm
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.contrib import messages
from django.db.models import Q, Avg
from django.http import JsonResponse, HttpResponseForbidden, HttpResponse
from .utils import send_order_confirmation_email
from django.db import transaction
from django.forms import inlineformset_factory
from django.views.decorators.http import require_POST
from django.contrib.auth import login
from django.urls import reverse
from django.template.loader import render_to_string  # Import


def product_list(request):
     #... (The rest of your product_list view - no changes needed here) ...
    products = Product.objects.filter(is_available=True).annotate(avg_rating=Avg('reviews__rating'))

    # --- Search ---
    query = request.GET.get('q')
    if query:
        products = products.filter(
            Q(name__icontains=query) |
            Q(description__icontains=query) |
            Q(category__name__icontains=query) |
            Q(category__parent__name__icontains=query)  # Search in parent category name
        )

    # --- Filtering ---
    category_slug = request.GET.get('category')
    min_price = request.GET.get('min_price')
    max_price = request.GET.get('max_price')
    sort_by = request.GET.get('sort_by')
    condition = request.GET.get('condition')

    selected_category = None
    if category_slug:
        selected_category = get_object_or_404(Category, slug=category_slug)
        # Get all descendant categories (including sub-subcategories, etc.)
        categories = [selected_category] + list(selected_category.children.all())

        # Get children and children of children and ... (Recursive function)
        def get_descendants(category, descendants_list):
            for child in category.children.all():
                descendants_list.append(child)
                get_descendants(child, descendants_list)  # Recursion!
        get_descendants(selected_category, categories)

        products = products.filter(category__in=categories)  # Filter by this set

    if min_price:
        products = products.filter(price__gte=min_price)
    if max_price:
        products = products.filter(price__lte=max_price)
    if condition:
        products = products.filter(condition=condition)

    # --- Sorting ---
    if sort_by == 'price_asc':
        products = products.order_by('price')
    elif sort_by == 'price_desc':
        products = products.order_by('-price')
    elif sort_by == 'rating':
        products = products.order_by('-avg_rating')
    else:
        products = products.order_by('-created_at')


    # --- Pagination/Infinite Scroll ---
    # We *still* paginate, but with a smaller page size for AJAX
    paginator = Paginator(products, 8)  # Show 8 products per page (for infinite scroll)
    page = request.GET.get('page')
    try:
        products = paginator.page(page)
    except PageNotAnInteger:
        products = paginator.page(1)  # If page is not an integer, deliver first page.
    except EmptyPage:
        if request.headers.get('x-requested-with') == 'XMLHttpRequest':
            # Important:  Return an empty response for AJAX requests when out of pages
            return HttpResponse('')  # No more products, return empty response
        products = paginator.page(paginator.num_pages)

    categories = Category.objects.filter(parent=None)  # Only top-level categories for sidebar

    # --- Get data for the right sidebar ---
    offers = SidebarOffer.objects.filter(active=True)  # Get active offers
    news_items = SidebarNewsItem.objects.filter(active=True)[:3]  # Get top 3 active news items

     # --- Handle Subscription Form ---
    if request.method == 'POST' and 'subscribe_submit' in request.POST: # Check for submit button name
        subscription_form = SubscriptionForm(request.POST)
        if subscription_form.is_valid():
            email = subscription_form.cleaned_data['email']
            category = subscription_form.cleaned_data['category']

            # Create subscription. The unique_together in the model prevents duplicates.
            try:
              Subscription.objects.get_or_create(email=email, category=category)
              messages.success(request, "You have successfully subscribed!")
            except Exception as e:
                messages.warning(request, "Something went wrong")


            # Best practice: Redirect after POST to prevent resubmission
            return redirect('product_list')  # Redirect to the product list


    else:
        subscription_form = SubscriptionForm() # Create a form


    context = {
        'products': products,
        'categories': categories,
        'query': query,
        'selected_category': selected_category,
        'min_price': min_price,
        'max_price': max_price,
        'sort_by': sort_by,
        'condition': condition,
        'offers': offers,        # Add offers to the context
        'news_items': news_items, # Add news items to the context
        'subscription_form': subscription_form,  # Add form to context
    }

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        # For AJAX requests, render *only* the product list items, NOT the whole page.
        return render(request, 'marketplace/product_list_ajax.html', context)
    else:
        # For initial page load, render the full page.
        return render(request, 'marketplace/product_list.html', context)


def product_detail(request, slug):
    product = get_object_or_404(Product, slug=slug, is_available=True)
    reviews = product.reviews.filter(parent=None).order_by('-created_at')  # Only top-level reviews.
    images = product.images.all() # Get all images

    has_reviewed = False
    if request.user.is_authenticated:
        has_reviewed = product.reviews.filter(user=request.user, parent=None).exists() # Check for top level reviews only

    if request.method == 'POST' and request.user.is_authenticated:
        # Check if the POST is for a review or a reply
        if 'review_submit' in request.POST:  # Use a name attribute on submit buttons
            review_form = ReviewForm(request.POST)
            if review_form.is_valid():
                if has_reviewed:
                    messages.warning(request, "You have already reviewed this product.")
                else:
                    review = review_form.save(commit=False)
                    review.product = product
                    review.user = request.user
                    review.save()
                    messages.success(request, "Review submitted successfully!")
                return redirect('product_detail', slug=product.slug) # redirect after post

        elif 'reply_submit' in request.POST:  #Check submit button
            reply_form = ReplyForm(request.POST)
            if reply_form.is_valid():
                reply = reply_form.save(commit=False)
                reply.product = product  # VERY IMPORTANT - set the product
                reply.user = request.user
                parent_id = request.POST.get('parent_id')  # Get from hidden field
                reply.parent = get_object_or_404(Review, id=parent_id)
                reply.save()
                messages.success(request,"Reply added.")
                return redirect('product_detail', slug=product.slug) # redirect

    else:
        review_form = ReviewForm()
        reply_form = ReplyForm()  # Create an instance for use in the template.

     # --- Related Products (Initial Load - 4 items) ---
    related_products_list = Product.objects.filter(category=product.category, is_available=True).exclude(pk=product.pk)
    paginator = Paginator(related_products_list, 6)  # Show 4 related products per page
    related_products = paginator.get_page(1)  # Get *first* page for initial display


    context = {
        'product': product,
        'reviews': reviews,
        'review_form': review_form,
        'has_reviewed': has_reviewed,
        'images' : images, # Pass to the context
        'reply_form': reply_form,
        'related_products': related_products,  # Add related products to context
    }
    return render(request, 'marketplace/product_detail.html', context)

# --- AJAX view for loading more related products ---
def related_products_partial(request, slug):
    product = get_object_or_404(Product, slug=slug)
    page_number = request.GET.get('page')

    related_products_list = Product.objects.filter(
        category=product.category, is_available=True
    ).exclude(pk=product.pk)
    paginator = Paginator(related_products_list, 4)  # 4 per page

    try:
        related_products = paginator.page(page_number)
    except PageNotAnInteger:
        related_products = paginator.page(1)  # Default to page 1
    except EmptyPage:
        return JsonResponse({'has_next': False, 'html': ''})  # No more pages

    html = render_to_string(
        'marketplace/includes/related_products_partial.html',  # Render the partial
        {'related_products': related_products},
        request=request,
    )
    return JsonResponse({'has_next': related_products.has_next(), 'html': html})



@login_required
def product_create(request):
    if request.method == 'POST':
        form = ProductForm(request.POST)
        formset = ProductImageFormSet(request.POST, request.FILES)  # Use the formset

        if form.is_valid() and formset.is_valid():
            product = form.save(commit=False)
            product.seller = request.user
            product.save()  # Save the product *first*

            # Save the formset (images) and associate with product.
            #formset.save()  # This *almost* works, but doesn't set product
            for form_instance in formset.forms:
                if form_instance.cleaned_data.get('image'): # Check if image was actually uploaded.
                  image = form_instance.save(commit=False)
                  image.product = product  # Associate with the new product
                  image.save()

            messages.success(request, "Product created successfully!")
            return redirect('product_detail', slug=product.slug)  # Redirect to the new product

    else:
        form = ProductForm()
        formset = ProductImageFormSet(queryset=ProductImage.objects.none())  # Empty initial

    context = {'form': form, 'formset': formset}  # Pass *both* to the template
    return render(request, 'marketplace/product_create.html', context)


@login_required
def product_update(request, slug):
    product = get_object_or_404(Product, slug=slug)
    if product.seller != request.user:
        return HttpResponseForbidden("You are not allowed to edit this product.")

    if request.method == 'POST':
        form = ProductForm(request.POST, instance=product)
        formset = ProductImageFormSet(request.POST, request.FILES, instance=product) # Use formset

        if form.is_valid() and formset.is_valid():
            form.save()
            formset.save()  # Saves, updates, *and* deletes images.
            messages.success(request, "Product updated successfully!")
            return redirect('product_detail', slug=product.slug)
    else:
        form = ProductForm(instance=product)
        formset = ProductImageFormSet(instance=product)  # Pass the product instance

    context = {'form': form, 'product': product, 'formset': formset} # Pass formset
    return render(request, 'marketplace/product_update.html', context)


@login_required
def product_delete(request, slug):
    product = get_object_or_404(Product, slug=slug)
    if product.seller != request.user:
        return HttpResponseForbidden("You are not allowed to delete this product.")

    if request.method == 'POST':
        product.delete()
        messages.success(request, "Product deleted successfully!")
        return redirect('product_list')
    return render(request, 'marketplace/product_delete.html', {'product': product})




def register(request):
    if request.method == 'POST':
        user_form = UserRegistrationForm(request.POST)
        if user_form.is_valid():
            user = user_form.save()
            login(request, user)  # Log in the new user
            messages.success(request, "Registration successful!")
            return redirect('product_list') # Redirect to home, not login
    else:
        user_form = UserRegistrationForm()

    return render(request, 'registration/register.html', {'user_form': user_form,})


@login_required
def user_profile(request):
    user_products = Product.objects.filter(seller=request.user)
    user_orders = Order.objects.filter(user=request.user).order_by('-order_date')
    context = {
        'user_products': user_products,
        'user_orders': user_orders,
        'user': request.user,  # Pass the user object for profile access
    }
    return render(request, 'marketplace/user_profile.html', context)


@login_required
def dashboard(request):
    if request.user.is_staff or Product.objects.filter(seller=request.user).exists():
        products = Product.objects.filter(seller=request.user)
        seller_orders = Order.objects.filter(orderitem_set__product__seller=request.user).distinct().order_by('-order_date')
        context = {
            'products': products,
            'seller_orders': seller_orders
        }
        return render(request, 'marketplace/dashboard.html', context)
    else:
        return redirect('user_profile')


@login_required
@require_POST  # Use require_POST decorator, add to cart only with POST
def add_to_cart(request, slug):
    product = get_object_or_404(Product, slug=slug)
    quantity = int(request.POST.get('quantity', 1))  # Get quantity, default to 1

    if quantity < 1:
        quantity = 1
        messages.warning(request, "Quantity must be at least 1.")  # Use messages framework
    elif quantity > product.stock:
        quantity = product.stock
        messages.warning(request,"Not enough stock available. Quantity adjusted to available stock.")

    cart = request.session.get('cart', {})
    product_id_str = str(product.id)  # Convert to string for dictionary key

    if product_id_str in cart:
        cart[product_id_str] += quantity  # Add to existing quantity
    else:
        cart[product_id_str] = quantity

    if cart[product_id_str] > product.stock: # Ensure cart quantity doesn't exceed stock
        cart[product_id_str] = product.stock

    request.session['cart'] = cart
    messages.success(request, f"{product.name} (x{quantity}) added to cart.")  # Show success message

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({'success': True, 'message': f"{product.name} (x{quantity}) added to cart.", 'cart_count': len(cart)})
    else:
      return redirect('product_detail', slug=product.slug)


@login_required
def view_cart(request):
    cart = request.session.get('cart', {})
    cart_items = []
    total_price = 0

    for product_id_str, quantity in cart.items():
        try:
            product = Product.objects.get(id=int(product_id_str))  # Convert back to integer
            subtotal = product.price * quantity
            total_price += subtotal
            cart_items.append({'product': product, 'quantity': quantity, 'subtotal': subtotal})
        except Product.DoesNotExist:
            # Handle the case where the product has been deleted.
            continue

    context = {
        'cart_items': cart_items,
        'total_price': total_price,
    }
    return render(request, 'marketplace/view_cart.html', context)

@login_required
@require_POST
def update_cart(request, product_id):
    cart = request.session.get('cart', {})
    product_id_str = str(product_id)  # Convert to string for dictionary key

    if product_id_str in cart:
        quantity = int(request.POST.get('quantity', 1))
        try:
          product = Product.objects.get(id=int(product_id)) # Check for product availability
        except:
            messages.warning(request, "Product is no longer available.")
            del cart[product_id_str]  # Remove from cart if not available
            request.session['cart'] = cart
            return redirect('view_cart') # Redirect to cart

        if quantity > 0 and quantity <= product.stock:
            cart[product_id_str] = quantity
        elif quantity <= 0:
            del cart[product_id_str]  # Remove if quantity is zero or less
            messages.info(request, "Item removed from cart.")
        else:
            cart[product_id_str] = product.stock #Set to maximum.
            messages.warning(request, f"Quantity exceeds available stock. Quantity adjusted to {product.stock}")
        request.session['cart'] = cart  # ALWAYS update the session

    return redirect('view_cart')


@login_required
@require_POST
def remove_from_cart(request, product_id):
    cart = request.session.get('cart', {})
    product_id_str = str(product_id)

    if product_id_str in cart:
        del cart[product_id_str]
        request.session['cart'] = cart  # Update session
        messages.info(request, "Item removed from cart.")

    return redirect('view_cart')

@login_required
def checkout(request):
    cart = request.session.get('cart', {})
    if not cart:
        messages.warning(request, "Your cart is empty.")
        return redirect('product_list')  # Redirect to products if cart empty

    cart_items = []
    total_price = 0

    for product_id_str, quantity in cart.items():
        product = get_object_or_404(Product, id=int(product_id_str))
        subtotal = product.price * quantity
        total_price += subtotal
        cart_items.append({'product': product, 'quantity': quantity, 'subtotal': subtotal})

    if request.method == 'POST':
        with transaction.atomic():  # Use transaction for atomicity
            order = Order.objects.create(user=request.user, total_price=total_price)

            for item in cart_items:
                product = item['product']
                quantity = item['quantity']
                # Check stock *again* within the transaction
                if product.stock < quantity:
                    raise Exception(f"Not enough stock for {product.name}")  # Rollback

                OrderItem.objects.create(order=order, product=product, quantity=quantity, price=product.price)
                product.stock -= quantity
                product.save()

            # Clear cart *after* successful order creation
            request.session['cart'] = {}
            messages.success(request, "Your order has been placed!")
            send_order_confirmation_email(order)  # Email confirmation
            return redirect('order_confirmation', order_id=order.id)  # Redirect

    context = {
        'cart_items': cart_items,
        'total_price': total_price,
    }
    return render(request, 'marketplace/checkout.html', context)


@login_required
def order_confirmation(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)
    order_items = order.orderitem_set.all() # Fetch order items
    context = {'order': order,
              'order_items': order_items,
              }
    return render(request, 'marketplace/order_confirmation.html', context)


def category_list(request):
    categories = Category.objects.all()
    context = {
        'categories': categories,
    }
    return render(request, 'marketplace/category_list.html', context)



def category_products(request, slug):
    category = get_object_or_404(Category, slug=slug)
    products = Product.objects.filter(category=category, is_available=True) # Only show if available
    context = {
        'category': category,
        'products': products
    }
    return render(request, 'marketplace/category_products.html', context)

@login_required
def order_list(request):
    orders = Order.objects.filter(user=request.user).order_by('-order_date')
    context = {'orders': orders}
    return render(request, 'marketplace/order_list.html', context)

# Make *sure* you also have the `order_detail` view:
@login_required
def order_detail(request, order_id):
    order = get_object_or_404(Order, id=order_id)
    if order.user != request.user and not request.user.is_staff:
        return HttpResponseForbidden("You are not allowed to view this order.")

    order_items = order.orderitem_set.all()
    context = {'order': order, 'order_items': order_items}
    return render(request, 'marketplace/order_detail.html', context)

def search_results(request):
    query = request.GET.get('q')
    results = []

    if query:
        results = Product.objects.filter(
            Q(name__icontains=query) |
            Q(description__icontains=query) |
            Q(category__name__icontains=query)|
            Q(category__parent__name__icontains=query)
        ).distinct()

    context = {
        'query': query,
        'results': results,
    }
    return render(request, 'marketplace/search_results.html', context) # Create this template