from django.contrib.admin.views.decorators import staff_member_required
from .models import MobileNetwork, SubscriptionTier, LipaNumber, Subscription, PaymentConfirmation
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, HttpResponseForbidden, JsonResponse
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import Q, Avg
from django.template.loader import render_to_string
from django.contrib.auth import get_user_model, login
from django.views.decorators.http import require_POST, require_GET
import logging
from .models import Product, Category, Review, Like, Order, OrderItem, ProductImage, SidebarOffer, SidebarNewsItem, UserProfile, Follow
from .forms import ProductForm, ProductImageFormSet, ReviewForm, ReplyForm, SubscriptionForm, ProfileUpdateForm, UserRegistrationForm
from django.db import transaction
from .utils import send_order_confirmation_email

@login_required
def subscription_choose_tier(request):
    tiers = SubscriptionTier.objects.filter(is_active=True)
    return render(request, 'marketplace/subscription_tiers.html', {'tiers': tiers})

@login_required
def subscription_payment_view(request):
    tier_id = request.GET.get('tier')
    tier = get_object_or_404(SubscriptionTier, pk=tier_id, is_active=True)
    networks = MobileNetwork.objects.prefetch_related('lipa_numbers').all()
    return render(request, 'marketplace/subscription_payment.html', {'tier': tier, 'networks': networks})

@login_required
def subscription_confirm_payment(request):
    # Implement payment confirmation logic here
    return render(request, 'marketplace/subscription_confirm_payment.html')

@login_required
def subscription_status(request):
    # Implement status logic here
    return render(request, 'marketplace/subscription_status.html')

from django.shortcuts import render
def product_list(request):
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
    if category_slug and category_slug not in ["", "None", None]:
        try:
            selected_category = Category.objects.get(slug=category_slug)
            # Get all descendant categories (including sub-subcategories, etc.)
            categories = [selected_category] + list(selected_category.get_descendants(include_self=True))
            products = products.filter(category__in=categories)  # Filter by this set
        except Category.DoesNotExist:
            selected_category = None
            # Ignore category filter if not found

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
    # AJAX request handling *before* standard pagination
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        page = request.GET.get('page')
        paginator = Paginator(products, 8)  # 8 products per page for AJAX loads
        try:
            products = paginator.page(page)
        except PageNotAnInteger:
            return HttpResponse('')  # Return empty response for invalid page
        except EmptyPage:
            return HttpResponse('')   # Return empty if out of pages.  JavaScript will stop.

        return render(request, 'marketplace/product_list_ajax.html', {'products': products, 'page': int(page)+1}) # Pass the page number.  Important!


    # --- Standard Pagination (for initial page load) ---
    paginator = Paginator(products, 12)  # 12 products on the first page load.
    page = request.GET.get('page', 1)  # Default to page 1
    try:
        products = paginator.page(page)
    except PageNotAnInteger:
        products = paginator.page(1)  # If page is not an integer, deliver first page.
    except EmptyPage:
        products = paginator.page(paginator.num_pages)  # If out of range, deliver last page.


    categories = Category.objects.filter(parent=None)  # Only top-level categories for sidebar

    # --- Get data for the right sidebar ---
    offers = SidebarOffer.objects.filter(active=True)[:3]  # Get active offers, limit to 3
    news_items = SidebarNewsItem.objects.filter(active=True)[:3]  # Get top 3 active news items

    # --- Handle Subscription Form ---
    if request.method == 'POST' and 'subscribe_submit' in request.POST: # Check for submit button name
        subscription_form = SubscriptionForm(request.POST)
        if subscription_form.is_valid():
            email = subscription_form.cleaned_data['email']
            category = subscription_form.cleaned_data['category']
            # subscription.save()
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
        'query': query,  # For search term persistence
        'selected_category': selected_category,
        'selected_category_slug' : category_slug,
        'min_price': min_price,
        'max_price': max_price,
        'sort_by': sort_by,
        'condition': condition,
        'offers': offers,
        'news_items': news_items,
        'subscription_form': subscription_form,
        'page': page,  # Pass the current page number
    }
    return render(request, 'marketplace/product_list.html', context)

def product_detail(request, slug):
    product = get_object_or_404(Product, slug=slug)
    images = getattr(product, 'images', None)
    if images is not None:
        images = images.all()
    else:
        images = []
    reviews = getattr(product, 'reviews', None)
    if reviews is not None:
        reviews = reviews.filter(parent__isnull=True)
    else:
        reviews = []
    related_products = Product.objects.filter(category=product.category).exclude(pk=product.pk)[:4]
    review_form = ReviewForm()
    reply_form = ReplyForm()
    has_reviewed = False
    if request.user.is_authenticated:
         has_reviewed = Review.objects.filter(product=product, user=request.user).exists()


    if request.method == 'POST':
      if 'review_submit' in request.POST: #Check for review submission
        if request.user.is_authenticated and not has_reviewed:
            review_form = ReviewForm(request.POST)
            if review_form.is_valid():
                review = review_form.save(commit=False)
                review.product = product
                review.user = request.user
                review.save()
                return redirect('product_detail', slug=product.slug)

      elif 'reply_submit' in request.POST: #Check for reply submission
        if request.user.is_authenticated:
            reply_form = ReplyForm(request.POST)
            if reply_form.is_valid():
                reply = reply_form.save(commit=False)
                reply.user = request.user
                reply.product = product  # Make sure to set the product
                parent_id = request.POST.get('parent_id')
                reply.parent = Review.objects.get(id=parent_id)
                reply.save()
                return redirect('product_detail', slug=product.slug) # Redirect after POST.

    # Add user profile info for sidebar verification card
    user_profile = None
    if request.user.is_authenticated:
        try:
            user_profile = request.user.profile
        except Exception:
            user_profile = None
    context = {
        'product': product,
        'images': images,
        'reviews': reviews,
        'related_products': related_products,
        'review_form': review_form,
        'reply_form': reply_form,
        'has_reviewed': has_reviewed,
        'user': request.user,
        'profile': user_profile,
    }
    return render(request, 'marketplace/product_detail.html', context)


def get_related_products(request, slug):
    print(f"Fetching related products for slug: {slug}") 
    product = get_object_or_404(Product, slug=slug)
    page = request.GET.get('page', 1)

    related_products = Product.objects.filter(
        category=product.category, is_available=True
    ).exclude(pk=product.pk)

    paginator = Paginator(related_products, 4)  # 4 per page
    try:
        products_page = paginator.page(page)
    except PageNotAnInteger:
        products_page = paginator.page(1)
    except EmptyPage:
        # Return empty response if out of range.  Important for infinite scroll.
        return HttpResponse('')

    # Render the partial template to a string
    html = render_to_string(
        'marketplace/includes/related_products_partial.html',  # Path to partial template
        {'related_products': products_page},  # Context
        request=request  # Pass the request object!
    )
    return HttpResponse(html)

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
        return redirect('product_list')  # Or another appropriate URL
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
def user_profile(request, username):
    User = get_user_model()
    profile_user = get_object_or_404(User, username=username)
    try:
        user_profile = getattr(profile_user, 'profile', None)
        if user_profile is None:
            return HttpResponse("Profile not found", status=404)
    except Exception:
        return HttpResponse("Profile not found", status=404)
    user_products = Product.objects.filter(seller=profile_user, is_available=True)
    if request.user == profile_user:
        user_orders = Order.objects.filter(user=profile_user).order_by('-order_date')
    else:
        user_orders = None
    is_following = False
    if request.user.is_authenticated:
        try:
            req_profile = getattr(request.user, 'profile', None)
            if req_profile is not None:
                is_following = req_profile.following.filter(following=user_profile).exists()
        except Exception:
            is_following = False
    total_products = user_products.count()
    try:
        followers_attr = getattr(user_profile, 'followers', None)
        if followers_attr is not None and hasattr(followers_attr, 'count'):
            total_followers = followers_attr.count()
        else:
            total_followers = 0
    except Exception:
        total_followers = 0
    try:
        req_profile = getattr(request.user, 'profile', None)
        if req_profile is not None:
            following_attr = getattr(req_profile, 'following', None)
            if following_attr is not None and hasattr(following_attr, 'count'):
                total_following = following_attr.count()
            else:
                total_following = 0
        else:
            total_following = 0
    except Exception:
        total_following = 0
    total_orders_received = 0
    if request.user == profile_user:
        total_orders_received = Order.objects.filter(orderitem_set__product__seller=request.user).distinct().count()
    context = {
        'user_profile': user_profile,
        'user_products': user_products,
        'user_orders': user_orders,
        'is_following': is_following,
        'total_products': total_products,
        'total_followers': total_followers,
        'total_following': total_following,
        'total_orders_received': total_orders_received,
    }
    return render(request, 'marketplace/user_profile.html', context)

@login_required
def edit_profile(request):
    if request.method == 'POST':
        form = ProfileUpdateForm(request.POST, request.FILES, instance=request.user.profile)
        if form.is_valid():
            form.save()
            messages.success(request, 'Your profile has been updated!')
            return redirect('user_profile', username=request.user.username)  # Redirect to profile
    else:
        form = ProfileUpdateForm(instance=request.user.profile)  # Use request.user

    return render(request, 'marketplace/edit_profile.html', {'form': form})

@login_required
def dashboard(request):
    # Only allow access to the dashboard if the user is staff or is a seller.
    if not request.user.is_staff and not request.user.products.exists():
        return HttpResponseForbidden("You are not authorized to view this page.")
    products = Product.objects.filter(seller=request.user)
    # Orders that *contain* products sold by this user.
    seller_orders = Order.objects.filter(orderitem_set__product__seller=request.user).distinct()
    context = {
        'products': products,
        'seller_orders': seller_orders,
    }
    return render(request, 'marketplace/dashboard.html', context)
@login_required
@require_POST
def add_to_cart(request, slug):
    product = get_object_or_404(Product, slug=slug, is_available=True)
    quantity = int(request.POST.get('quantity', 1))

    if quantity <= 0:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'status': 'error', 'message': 'Quantity must be greater than zero.'}, status=400)
        messages.warning(request, "Quantity must be greater than zero.")
        return redirect('product_detail', slug=product.slug)

    if quantity > product.stock:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'status': 'error', 'message': 'Requested quantity exceeds available stock.'}, status=400)
        messages.warning(request, "Requested quantity exceeds available stock.")
        return redirect('product_detail', slug=product.slug)

    cart = request.session.get('cart', {})
    product_id_str = str(product.pk)

    if product_id_str in cart:
        new_quantity = cart[product_id_str] + quantity
        if new_quantity > product.stock:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'status': 'error', 'message': f'Adding {quantity} exceeds available stock. Cart not updated.'}, status=400)
            messages.warning(request, f"Adding {quantity} exceeds available stock. Cart not updated.")
            return redirect('product_detail', slug=product.slug)
        cart[product_id_str] = new_quantity
    else:
        cart[product_id_str] = quantity

    request.session['cart'] = cart
    cart_items_count = sum(cart.values())

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({
            'status': 'success',
            'message': f"{quantity} x {product.name} added to cart.",
            'cart_items_count': cart_items_count
        })
    else:
        messages.success(request, f"{quantity} x {product.name} added to cart.")
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
        request.session['cart'] = cart
        message = "Item removed from cart."
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'status': 'success',
                'message': message,
                'cart_items_count': sum(cart.values())
            })
        messages.info(request, message)
    else:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'status': 'error', 'message': 'Item not in cart.'}, status=400)
        messages.warning(request, "Item not in cart.")

    return redirect('view_cart')

@login_required
def checkout(request):
    cart = request.session.get('cart', {})
    if not cart:
        messages.warning(request, "Your cart is empty.")
        return redirect('product_list')
    cart_items = []
    total_price = 0
    for product_id_str, quantity in cart.items():
        product = get_object_or_404(Product, pk=int(product_id_str))
        subtotal = product.price * quantity
        total_price += subtotal
        cart_items.append({'product': product, 'quantity': quantity, 'subtotal': subtotal})
    if request.method == 'POST':
        with transaction.atomic():
            order = Order.objects.create(user=request.user, total_price=total_price)
            for item in cart_items:
                product = item['product']
                quantity = item['quantity']
                if product.stock < quantity:
                    raise Exception(f"Not enough stock for {product.name}")
                OrderItem.objects.create(order=order, product=product, quantity=quantity, price=product.price)
                product.stock -= quantity
                product.save()
            request.session['cart'] = {}
            messages.success(request, "Your order has been placed!")
            send_order_confirmation_email(order)
            return redirect('order_confirmation', order_id=order.pk)
    context = {
        'cart_items': cart_items,
        'total_price': total_price,
    }
    return render(request, 'marketplace/checkout.html', context)

@login_required
def order_confirmation(request, order_id):
    order = get_object_or_404(Order, pk=order_id, user=request.user)
    order_items = getattr(order, 'orderitem_set', None)
    if order_items is not None:
        order_items = order_items.all()
    else:
        order_items = []
    context = {'order': order, 'order_items': order_items}
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
    order = get_object_or_404(Order, pk=order_id)
    if order.user != request.user and not request.user.is_staff:
        return HttpResponseForbidden("You are not allowed to view this order.")
    order_items = getattr(order, 'orderitem_set', None)
    if order_items is not None:
        order_items = order_items.all()
    else:
        order_items = []
    context = {'order': order, 'order_items': order_items}
    return render(request, 'marketplace/order_detail.html', context)

logger = logging.getLogger(__name__)

@require_GET
def search_results(request):
    """
    Handle product search requests and render search results.
    
    Args:
        request: HTTP request object containing query parameters
    
    Returns:
        Rendered HTML response with search results
    """
    try:
        query = request.GET.get('q', '').strip()
        
        # Initialize empty context
        context = {
            'query': query,
            'results': [],
            'page_obj': None,
        }

        if query:
            # Optimize query with select_related and prefetch_related
            results = Product.objects.select_related(
                'seller', 'category', 'seller__profile'
            ).prefetch_related(
                'category__parent'
            ).filter(
                Q(name__icontains=query) |
                Q(description__icontains=query) |
                Q(category__name__icontains=query) |
                Q(category__parent__name__icontains=query)
            ).distinct()

            # Add pagination
            paginator = Paginator(results, 12)  # 12 items per page
            page = request.GET.get('page')
            
            try:
                page_obj = paginator.page(page)
            except PageNotAnInteger:
                page_obj = paginator.page(1)
            except EmptyPage:
                page_obj = paginator.page(paginator.num_pages)

            context['results'] = page_obj
            context['page_obj'] = page_obj

        return render(request, 'marketplace/search_results.html', context)

    except Exception as e:
        logger.error(f"Error in search_results: {str(e)}")
        context['error'] = "An unexpected error occurred. Please try again later."
        return render(request, 'marketplace/search_results.html', context)

@login_required
def user_products(request):
    """Displays a list of products owned by the currently logged-in user."""
    products = Product.objects.filter(seller=request.user, is_available=True).order_by('-created_at')
    return render(request, 'marketplace/user_products.html', {'products': products})

@login_required
@require_POST  # Only accept POST requests for security
def follow_user(request):
    username = request.POST.get('username') # Get from POST data
    user_to_follow = get_object_or_404(get_user_model(), username=username)

    if request.user == user_to_follow:
        return JsonResponse({'status': 'error', 'message': 'You cannot follow yourself'})

    try:
        user_to_follow_profile = getattr(user_to_follow, 'profile', None)
        if user_to_follow_profile is None:
            return JsonResponse({'status': 'error', 'message': 'User profile not found'}, status=404)
        follow, created = Follow.objects.get_or_create(follower=request.user, following=user_to_follow_profile)
        if not created:
            follow.delete()
            action = 'follow'
        else:
            action = 'unfollow'
        followers_attr = getattr(user_to_follow_profile, 'followers', None)
        if followers_attr is not None and hasattr(followers_attr, 'count'):
            followers_count = followers_attr.count()
        else:
            followers_count = 0
        return JsonResponse({'status': 'ok', 'action': action, 'followers': followers_count})
    except UserProfile.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'User profile not found'}, status=404)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
@require_POST
def like_product(request, product_id):
    product = get_object_or_404(Product, pk=product_id, is_available=True)
    like, created = Like.objects.get_or_create(user=request.user, product=product)
    if not created:
        like.delete()
        liked = False
    else:
        liked = True
    likes = getattr(product, 'likes', None)
    if likes is not None:
        like_count = likes.count()
    else:
        like_count = 0
    data = {
        'liked': liked,
        'like_count': like_count,
    }
    return JsonResponse(data)