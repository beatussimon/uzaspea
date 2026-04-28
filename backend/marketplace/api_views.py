from rest_framework import viewsets, permissions, status, decorators, serializers as drf_serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q, Sum, Count, Avg
from django.db import models as django_models
from .models import (
    Product, Category, Review, ProductComment, Order, OrderItem, 
    Payment, TrackingEvent, UserProfile, Like, ProductImage
)
from .serializers import (
    ProductSerializer, CategorySerializer, ProductReviewSerializer, 
    ProductCommentSerializer, OrderSerializer, PaymentSerializer, UserProfileSerializer
)

from uzachuo.permissions import IsOwnerOrStaff, IsStaffMember
from django.db.models import Prefetch

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().prefetch_related('images', 'likes')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
        return super().get_permissions()
    lookup_field = 'slug'

    def get_queryset(self):
        # Base queryset
        base = Product.objects.all().prefetch_related('images', 'likes')
        
        # FIX: Ensure detail actions (delete/edit) don't get blocked by list filters
        if getattr(self, 'detail', False) or self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return base

        user = self.request.user
        category_slug = self.request.query_params.get('category', None)
        query = self.request.query_params.get('q', None)
        min_price = self.request.query_params.get('min_price', None)
        max_price = self.request.query_params.get('max_price', None)
        condition = self.request.query_params.get('condition', None)
        sort_by = self.request.query_params.get('sort_by', None)
        seller_param = self.request.query_params.get('seller', None)

        # FIX S-17: sellers can retrieve their own products regardless of availability
        if user.is_authenticated and self.request.query_params.get('mine') == 'true':
            queryset = base.filter(seller=user)
        elif user.is_authenticated and user.is_staff:
            queryset = base.all()
        elif seller_param:
            queryset = base.filter(seller__username=seller_param)
        else:
            # Public list only shows available products for general browsing
            queryset = base.filter(is_available=True)

        if category_slug:
            from .models import Category
            try:
                cat = Category.objects.get(slug=category_slug)
                descendants = cat.get_descendants(include_self=True)
                queryset = queryset.filter(category__in=descendants)
            except Category.DoesNotExist:
                queryset = queryset.filter(category__slug=category_slug)

        if query:
            queryset = queryset.filter(
                Q(name__icontains=query) | Q(description__icontains=query) |
                Q(category__name__icontains=query)
            )
        if min_price:
            queryset = queryset.filter(price__gte=min_price)
        if max_price:
            queryset = queryset.filter(price__lte=max_price)
        if condition:
            queryset = queryset.filter(condition=condition)

        if sort_by == 'price_asc':
            return queryset.order_by('price')
        elif sort_by == 'price_desc':
            return queryset.order_by('-price')
        elif sort_by == 'rating':
            return queryset.annotate(avg=Avg('reviews__rating')).order_by('-avg')
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        product = serializer.save(seller=self.request.user)
        images = self.request.FILES.getlist('uploaded_images')
        for img in images:
            ProductImage.objects.create(product=product, image=img)

    def perform_update(self, serializer):
        product = serializer.save()
        images = self.request.FILES.getlist('uploaded_images')
        if images:
            # Optionally clear existing images if it's a full replacement, 
            # but for now we'll just add new ones as per common MVP patterns
            for img in images:
                ProductImage.objects.create(product=product, image=img)

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, slug=None):
        product = self.get_object()
        like, created = Like.objects.get_or_create(user=request.user, product=product)
        if not created:
            like.delete()
            liked = False
        else:
            liked = True
        return Response({'liked': liked, 'like_count': product.likes.count()})

    @decorators.action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def seller_stats(self, request):
        from django.utils import timezone
        import datetime
        user = request.user
        products = Product.objects.filter(seller=user)
        orders = Order.objects.filter(orderitem_set__product__seller=user).distinct()
        today = timezone.now().date()

        # --- Revenue pipeline (last 7 days) --- Optimized
        PAID_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']  # FIX L-19
        start_date = today - datetime.timedelta(days=6)
        pipeline_items = OrderItem.objects.filter(
            product__seller=user, order__order_date__date__gte=start_date,
            order__status__in=PAID_STATUSES,  # FIX L-19
        ).values('order__order_date__date').annotate(
            rev=Sum('price'), count=Count('order', distinct=True)
        ).order_by('order__order_date__date')
        
        pipeline_map = {item['order__order_date__date']: item for item in pipeline_items}
        
        revenue_pipeline = []
        total_7d = 0
        for i in range(6, -1, -1):
            date = today - datetime.timedelta(days=i)
            entry = pipeline_map.get(date, {'rev': 0, 'count': 0})
            day_rev = float(entry['rev'] or 0)
            total_7d += day_rev
            revenue_pipeline.append({
                'date': date.strftime('%a'), 
                'revenue': day_rev, 
                'orders': entry['count']
            })

        # --- Previous 7 days for trend ---
        prev_start = today - datetime.timedelta(days=13)
        prev_7d = float(OrderItem.objects.filter(
            product__seller=user,
            order__order_date__date__gte=prev_start,
            order__order_date__date__lt=start_date,
        ).aggregate(t=Sum('price'))['t'] or 0)
        trend_pct = round(((total_7d - prev_7d) / prev_7d * 100) if prev_7d else 0, 1)

        # --- Order status breakdown ---
        status_counts = {}
        for s in ['CART','CHECKOUT','AWAITING_PAYMENT','PENDING_VERIFICATION','PAID','PROCESSING','SHIPPED','DELIVERED','COMPLETED','CANCELLED']:
            c = orders.filter(status=s).count()
            if c:
                status_counts[s] = c

        # --- Top 5 products by order count ---
        top_prods = (
            OrderItem.objects.filter(product__seller=user)
            .values('product__name', 'product__slug')
            .annotate(sold=Count('id'), rev=Sum('price'))
            .order_by('-sold')[:5]
        )
        top_products = [{'name': t['product__name'], 'slug': t['product__slug'], 'sold': t['sold'], 'revenue': float(t['rev'] or 0)} for t in top_prods]

        # --- Category breakdown ---
        cat_data = (
            OrderItem.objects.filter(product__seller=user)
            .values('product__category__name')
            .annotate(rev=Sum('price'), count=Count('id'))
            .order_by('-rev')[:8]
        )
        category_breakdown = [{'category': c['product__category__name'] or 'Other', 'revenue': float(c['rev'] or 0), 'items': c['count']} for c in cat_data]

        # --- Stock alerts (stock <= 3) ---
        low_stock = list(products.filter(stock__lte=3).values('name', 'slug', 'stock', 'price')[:10])
        for ls in low_stock:
            ls['price'] = float(ls['price'])

        # --- Aggregate metrics ---
        PAID_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']  # FIX L-19
        paid_orders = orders.filter(status__in=PAID_STATUSES)
        total_orders_count = paid_orders.count()
        total_revenue = float(paid_orders.aggregate(total=Sum('total_amount'))['total'] or 0)
        avg_order = round(total_revenue / total_orders_count, 2) if total_orders_count else 0
        total_reviews = Review.objects.filter(product__seller=user).count()
        avg_rating = float(products.aggregate(avg=Avg('reviews__rating'))['avg'] or 0)

        return Response({
            'total_products': products.count(),
            'total_orders': total_orders_count,
            'total_revenue': total_revenue,
            'avg_order_value': avg_order,
            'avg_rating': round(avg_rating, 1),
            'total_reviews': total_reviews,
            'revenue_trend_pct': trend_pct,
            'revenue_data': revenue_pipeline,
            'orders_by_status': status_counts,
            'top_products': top_products,
            'category_breakdown': category_breakdown,
            'stock_alerts': low_stock,
        })

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Order.objects.all().prefetch_related('orderitem_set__product', 'timeline_events', 'payments').order_by('-order_date')
        return Order.objects.filter(user=user).prefetch_related('orderitem_set__product', 'timeline_events', 'payments').order_by('-order_date')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @decorators.action(detail=True, methods=['post'])
    def advance(self, request, pk=None):
        from .services import OrderStateMachine
        order = self.get_object()
        
        # PERMISSION CHECK: Must be staff OR a seller of an item in this order
        is_seller = order.orderitem_set.filter(product__seller=request.user).exists()
        is_buyer = order.user == request.user  # FIX: S-06

        new_state = request.data.get('status')
        notes = request.data.get('notes', '')

        # FIX: S-06 — Enforce who can trigger which transitions
        STAFF_ONLY_STATES = {'PAID', 'COMPLETED', 'REFUNDED', 'EXPIRED'}
        SELLER_ALLOWED_STATES = {'PROCESSING', 'SHIPPED'}
        BUYER_ALLOWED_STATES = {'AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'CHECKOUT'}

        if new_state in STAFF_ONLY_STATES and not request.user.is_staff:
            return Response(
                {'error': f'Only staff can set order status to {new_state}.'},
                status=403
            )
        if new_state in SELLER_ALLOWED_STATES and not (request.user.is_staff or is_seller):
            return Response(
                {'error': f'Only the seller or staff can advance order to {new_state}.'},
                status=403
            )
        if new_state in BUYER_ALLOWED_STATES and not (request.user.is_staff or is_buyer):
            return Response(
                {'error': f'Only the buyer or staff can move order to {new_state}.'},
                status=403
            )

        # If not staff, buyer, or seller — deny
        if not (request.user.is_staff or is_seller or is_buyer):
            return Response({'detail': 'No permission to transition this order.'}, status=403)

        # If transitioning to PENDING_VERIFICATION, we might want to attach a payment record
        if new_state == 'PENDING_VERIFICATION':
            proof = request.FILES.get('proof_image')
            transaction_id = request.data.get('transaction_id', '')
            if proof or transaction_id:
                Payment.objects.create(
                    order=order,
                    payment_method='OFFLINE',
                    proof_image=proof,
                    transaction_id=transaction_id,
                    amount=order.total_amount,
                    status='PENDING_VERIFICATION'
                )
                notes = notes or f"Payment proof submitted: {transaction_id}"

        try:
            OrderStateMachine.transition_order(order, new_state, notes=notes)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': order.status})

    @decorators.action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        from .services import OrderStateMachine
        order = self.get_object()
        
        # PERMISSION CHECK: Must be staff, the buyer, or a seller of an item in this order
        is_buyer = order.user == request.user
        is_seller = order.orderitem_set.filter(product__seller=request.user).exists()
        
        if not (request.user.is_staff or is_buyer or is_seller):
            return Response({'detail': 'No permission to cancel this order.'}, status=403)

        notes = request.data.get('notes', 'Order cancelled.')
        try:
            OrderStateMachine.transition_order(order, 'CANCELLED', notes=notes)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': order.status})

    @decorators.action(detail=False, methods=['get'])
    def incoming(self, request):
        """Orders containing the current seller's products."""
        user = request.user
        
        # Prefetch only for this seller's items to avoid N+1 and leaking other seller's item data
        seller_items_prefetch = Prefetch(
            'orderitem_set',
            queryset=OrderItem.objects.filter(product__seller=user).select_related('product').prefetch_related('product__images'),
            to_attr='relevant_items'
        )

        order_ids = OrderItem.objects.filter(product__seller=user).values_list('order_id', flat=True).distinct()
        orders = Order.objects.filter(id__in=order_ids).prefetch_related(
            seller_items_prefetch, 'timeline_events', 'payments'
        ).select_related('user').order_by('-order_date')

        status_filter = request.query_params.get('status', None)
        if status_filter:
            orders = orders.filter(status=status_filter)

        page = self.paginate_queryset(orders)
        
        def format_order(order):
            items_data = []
            for item in order.relevant_items:
                # FIX: L-04 — use prefetched images, avoid 2 queries per item
                _imgs = list(item.product.images.all())
                items_data.append({
                    'id': item.id,
                    'product_name': item.product.name,
                    'product_slug': item.product.slug,
                    'product_image': _imgs[0].image.url if _imgs else None,
                    'quantity': item.quantity,
                    'price': float(item.price),
                    'subtotal': float(item.subtotal()),
                })

            timeline = [{'status': e.status, 'notes': e.notes, 'created_at': e.created_at.isoformat()} for e in order.timeline_events.all()]
            payments = [{
                'id': p.id,
                'status': p.status,
                'method': p.payment_method,
                'transaction_id': p.transaction_id,
                'proof_image': p.proof_image.url if p.proof_image else None,
                'amount': float(p.amount),
                'created_at': p.created_at.isoformat()
            } for p in order.payments.all()]

            return {
                'id': order.id,
                'buyer': order.user.username,
                'order_date': order.order_date.isoformat(),
                'status': order.status,
                'total_amount': float(order.total_amount),
                'seller_subtotal': sum(i['subtotal'] for i in items_data),
                'items': items_data,
                'timeline': timeline,
                'payments': payments,
            }

        if page is not None:
            data = [format_order(o) for o in page]
            return self.get_paginated_response(data)

        data = [format_order(o) for o in orders]
        return Response(data)

class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ProductReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        # FIX: L-05 — non-staff only see approved reviews
        product_id = self.request.query_params.get('product', None)
        qs = Review.objects.all()
        if not self.request.user.is_staff:
            qs = qs.filter(approved=True)
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def get_permissions(self):  # FIX: L-06
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
        return super().get_permissions()

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        # Strict anti-fraud check: User must have a COMPLETED order containing this product.
        has_completed_order = OrderItem.objects.filter(
            order__user=self.request.user,
            order__status='COMPLETED',
            product=product
        ).exists()
        
        if not has_completed_order:
            raise drf_serializers.ValidationError("You can only review products you have completely purchased and received.")
        
        serializer.save(user=self.request.user)

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStaffMember])
    def approve(self, request, pk=None):
        """FIX: M-05 — Staff can approve reviews."""
        review = self.get_object()
        review.approved = True
        review.save(update_fields=['approved'])
        return Response({'approved': True, 'id': review.id})

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStaffMember])
    def reject(self, request, pk=None):
        """FIX: M-05 — Staff can reject reviews."""
        review = self.get_object()
        review.delete()
        return Response(status=204)

class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = ProductCommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        product_id = self.request.query_params.get('product', None)
        if product_id:
            return ProductComment.objects.filter(product_id=product_id)
        return ProductComment.objects.all()

    def get_permissions(self):  # FIX: L-07
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Payment.objects.all()
        # Buyers see their own payments, Sellers see payments for their products
        return Payment.objects.filter(
            django_models.Q(order__user=user) | django_models.Q(order__orderitem_set__product__seller=user)
        ).distinct()

    # FIX: C-04 — Add payment verify/approve/reject actions for staff
    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStaffMember])
    def verify(self, request, pk=None):
        """Staff: approve a pending marketplace payment and advance order to PAID."""
        from .services import OrderStateMachine
        payment = self.get_object()
        if payment.status != 'PENDING_VERIFICATION':
            return Response({'error': 'Payment is not pending verification.'}, status=400)
        payment.status = 'VERIFIED'
        payment.save(update_fields=['status'])
        if payment.order:
            try:
                OrderStateMachine.transition_order(
                    payment.order, 'PAID',
                    notes=f'Payment #{payment.id} verified by {request.user.username}.'
                )
            except ValueError as e:
                return Response({'error': str(e)}, status=400)
        return Response({
            'payment_status': payment.status,
            'order_status': payment.order.status if payment.order else None
        })

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStaffMember])
    def reject(self, request, pk=None):
        """Staff: reject a pending payment and return order to AWAITING_PAYMENT."""
        from .services import OrderStateMachine
        payment = self.get_object()
        if payment.status != 'PENDING_VERIFICATION':
            return Response({'error': 'Payment is not pending verification.'}, status=400)
        payment.status = 'REJECTED'
        payment.save(update_fields=['status'])
        if payment.order and payment.order.status == 'PENDING_VERIFICATION':
            try:
                OrderStateMachine.transition_order(
                    payment.order, 'AWAITING_PAYMENT',
                    notes=f'Payment #{payment.id} rejected by {request.user.username}. Reason: {request.data.get("reason", "Not specified")}.'
                )
            except ValueError:
                pass
        return Response({'payment_status': payment.status})

from django.contrib.auth.models import User
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['username'] = self.user.username
        data['is_staff'] = self.user.is_staff or self.user.is_superuser
        data['is_superuser'] = self.user.is_superuser
        try:
            data['is_verified'] = self.user.profile.is_verified  # FIX: S-10
            data['tier'] = self.user.profile.tier
        except (UserProfile.DoesNotExist, AttributeError):  # FIX: S-10 — replace bare except with specific exceptions
            data['is_verified'] = False
            data['tier'] = 'standard'
        
        data['is_inspector'] = hasattr(self.user, 'inspector_profile')
        data['inspector_level'] = (
            self.user.inspector_profile.level
            if hasattr(self.user, 'inspector_profile') else None
        )
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        dob = request.data.get('date_of_birth')
        password = request.data.get('password')
        confirm_password = request.data.get('confirm_password')

        if not username or not password or not email:
            return Response({'detail': 'Username, email and password are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if password != confirm_password:
            return Response({'detail': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email).exists():
            return Response({'detail': 'An account with this email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(password)
        except Exception as e:
            return Response({'detail': list(e)}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username, 
            email=email, 
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        # Profile is created via post_save signal in models.py
        profile = user.profile
        if dob:
            profile.date_of_birth = dob
            profile.save()
        
        refresh = CustomTokenObtainPairSerializer.get_token(user)
        data = {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'username': user.username,
            'is_staff': user.is_staff or user.is_superuser,
            'is_superuser': user.is_superuser,
            'is_verified': False,
            'tier': profile.tier,
            'is_inspector': False,
            'inspector_level': None
        }
        return Response(data, status=status.HTTP_201_CREATED)

from .models import SponsoredListing
from .serializers import SponsoredListingSerializer

class UserProfileViewSet(viewsets.ModelViewSet):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = 'user__username'

    def get_queryset(self):
        return UserProfile.objects.all()

    def get_permissions(self):  # FIX: S-07
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
        return super().get_permissions()

class SponsoredListingViewSet(viewsets.ModelViewSet):
    serializer_class = SponsoredListingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        from django.utils import timezone as tz
        is_public = self.request.query_params.get('public', 'false').lower() == 'true'

        if is_public:
            return SponsoredListing.objects.filter(
                status='approved'
            ).filter(
                django_models.Q(expires_at__isnull=True) | django_models.Q(expires_at__gt=tz.now())
            ).order_by('?')

        if user.is_staff:
            return SponsoredListing.objects.all().order_by('-created_at')
        if user.is_authenticated:
            from django.utils import timezone as _tz
            # FIX S-16: show own listings + all public approved (non-expired) ones
            return SponsoredListing.objects.filter(
                django_models.Q(user=user) | django_models.Q(
                    status='approved',
                )
            ).filter(
                django_models.Q(expires_at__isnull=True) | django_models.Q(expires_at__gt=_tz.now())
            ).distinct().order_by('-created_at')
        return SponsoredListing.objects.filter(
            status='approved'
        ).filter(
            django_models.Q(expires_at__isnull=True) | django_models.Q(expires_at__gt=tz.now())  # FIX: L-12
        ).order_by('?')

    def get_object(self):  # FIX: S-08 — enforce queryset scope on detail views
        obj = super().get_object()
        user = self.request.user
        if not user.is_authenticated and obj.status != 'approved':
            from rest_framework.exceptions import NotFound
            raise NotFound()
        if user.is_authenticated and not user.is_staff and obj.user != user and obj.status != 'approved':
            from rest_framework.exceptions import NotFound
            raise NotFound()
        return obj

    def perform_create(self, serializer):
        duration_days = serializer.validated_data.get('duration_days', 7)
        amount = duration_days * 1000
        serializer.save(user=self.request.user, amount=amount)
