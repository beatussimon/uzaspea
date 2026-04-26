from rest_framework import viewsets, permissions, status, decorators, serializers as drf_serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q, Sum, Count, Avg
from .models import (
    Product, Category, Review, ProductComment, Order, OrderItem, 
    Payment, TrackingEvent, UserProfile, Like, ProductImage
)
from .serializers import (
    ProductSerializer, CategorySerializer, ProductReviewSerializer, 
    ProductCommentSerializer, OrderSerializer, PaymentSerializer, UserProfileSerializer
)

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_available=True).prefetch_related('images', 'likes')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = 'slug'

    def get_queryset(self):
        queryset = super().get_queryset()
        category_slug = self.request.query_params.get('category', None)
        query = self.request.query_params.get('q', None)
        min_price = self.request.query_params.get('min_price', None)
        max_price = self.request.query_params.get('max_price', None)
        condition = self.request.query_params.get('condition', None)
        sort_by = self.request.query_params.get('sort_by', None)
        seller = self.request.query_params.get('seller', None)

        if seller:
            queryset = queryset.filter(seller__username=seller)

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
        serializer.save(seller=self.request.user)

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

        # --- Revenue pipeline (last 7 days) ---
        revenue_pipeline = []
        total_7d = 0
        for i in range(6, -1, -1):
            date = today - datetime.timedelta(days=i)
            day_items = OrderItem.objects.filter(
                product__seller=user, order__order_date__date=date
            )
            day_rev = float(day_items.aggregate(t=Sum('price'))['t'] or 0)
            day_count = day_items.values('order').distinct().count()
            total_7d += day_rev
            revenue_pipeline.append({'date': date.strftime('%a'), 'revenue': day_rev, 'orders': day_count})

        # --- Previous 7 days for trend ---
        prev_items = OrderItem.objects.filter(
            product__seller=user,
            order__order_date__date__gte=today - datetime.timedelta(days=13),
            order__order_date__date__lt=today - datetime.timedelta(days=6),
        )
        prev_7d = float(prev_items.aggregate(t=Sum('price'))['t'] or 0)
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
        total_orders_count = orders.count()
        total_revenue = float(orders.aggregate(total=Sum('total_amount'))['total'] or 0)
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
        new_state = request.data.get('status')
        notes = request.data.get('notes', '')
        
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

    @decorators.action(detail=False, methods=['get'])
    def incoming(self, request):
        """Orders containing the current seller's products."""
        user = request.user
        order_ids = OrderItem.objects.filter(product__seller=user).values_list('order_id', flat=True).distinct()
        orders = Order.objects.filter(id__in=order_ids).prefetch_related(
            'orderitem_set__product__images', 'timeline_events', 'payments'
        ).select_related('user').order_by('-order_date')

        status_filter = request.query_params.get('status', None)
        if status_filter:
            orders = orders.filter(status=status_filter)

        data = []
        for order in orders:
            seller_items = order.orderitem_set.filter(product__seller=user)
            items_data = [{
                'id': item.id,
                'product_name': item.product.name,
                'product_slug': item.product.slug,
                'product_image': item.product.images.first().image.url if item.product.images.exists() else None,
                'quantity': item.quantity,
                'price': float(item.price),
                'subtotal': float(item.subtotal()),
            } for item in seller_items]

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

            data.append({
                'id': order.id,
                'buyer': order.user.username,
                'order_date': order.order_date.isoformat(),
                'status': order.status,
                'total_amount': float(order.total_amount),
                'seller_subtotal': sum(i['subtotal'] for i in items_data),
                'items': items_data,
                'timeline': timeline,
                'payments': payments,
            })

        return Response(data)

class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ProductReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        product_id = self.request.query_params.get('product', None)
        if product_id:
            return Review.objects.filter(product_id=product_id)
        return Review.objects.all()

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        # Strict anti-fraud check: User must have a COMPLETED order containing this product.
        has_completed_order = OrderItem.objects.filter(
            order__user=self.request.user,
            order__status='COMPLETED',
            product=product
        ).exists()
        
        if not has_completed_order:
            raise serializers.ValidationError("You can only review products you have completely purchased and received.")
        
        serializer.save(user=self.request.user)

class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = ProductCommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        product_id = self.request.query_params.get('product', None)
        if product_id:
            return ProductComment.objects.filter(product_id=product_id)
        return ProductComment.objects.all()

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
            models.Q(order__user=user) | models.Q(order__orderitem_set__product__seller=user)
        ).distinct()

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
            data['is_verified'] = self.user.profile.is_verified
            data['tier'] = self.user.profile.tier
        except:
            data['is_verified'] = False
            data['tier'] = 'free'
        
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
        password = request.data.get('password')
        confirm_password = request.data.get('confirm_password')

        if not username or not password or not email:
            return Response({'detail': 'Username, email and password are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if password != confirm_password:
            return Response({'detail': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(password)
        except Exception as e:
            return Response({'detail': list(e)}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email, password=password)
        profile = UserProfile.objects.create(user=user)
        
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

class SponsoredListingViewSet(viewsets.ModelViewSet):
    serializer_class = SponsoredListingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return SponsoredListing.objects.all().order_by('-created_at')
        if user.is_authenticated:
            return SponsoredListing.objects.filter(user=user).order_by('-created_at')
        return SponsoredListing.objects.filter(status='approved').order_by('?')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

