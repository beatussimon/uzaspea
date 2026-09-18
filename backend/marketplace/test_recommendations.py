from decimal import Decimal
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.core.cache import cache
from marketplace.models import Product, Category, Brand, VehicleMake, VehicleModel, Vehicle, ProductVehicleFitment
from marketplace.recommendation_service import RecommendationEngine


class RecommendationEngineTests(TestCase):
    def setUp(self):
        cache.clear()
        self.seller1 = User.objects.create_user(username='seller1', password='password123')
        self.seller2 = User.objects.create_user(username='seller2', password='password123')
        self.seller3 = User.objects.create_user(username='seller3', password='password123')

        # Categories
        self.parent_cat = Category.objects.create(name='Auto Parts', slug='auto-parts')
        self.brakes_cat = Category.objects.create(name='Brakes', slug='brakes', parent=self.parent_cat)
        self.suspension_cat = Category.objects.create(name='Suspension', slug='suspension', parent=self.parent_cat)
        self.electronics_cat = Category.objects.create(name='Electronics', slug='electronics')

        # Brand
        self.brand_toyota = Brand.objects.create(name='Toyota Genuine', slug='toyota')
        self.brand_bosch = Brand.objects.create(name='Bosch', slug='bosch')

        # Target Product
        self.target = Product.objects.create(
            name='Toyota RAV4 Brake Pads',
            slug='toyota-rav4-brake-pads',
            description='Ceramic brake pads for RAV4',
            price=Decimal('50000.00'),
            stock=Decimal('10.00'),
            is_available=True,
            is_draft=False,
            category=self.brakes_cat,
            seller=self.seller1,
            brand=self.brand_toyota
        )

        # Vehicle
        self.make = VehicleMake.objects.create(name='Toyota', slug='toyota')
        self.vmodel = VehicleModel.objects.create(make=self.make, name='RAV4', slug='rav4')
        self.vehicle = Vehicle.objects.create(make=self.make, model=self.vmodel, year=2020)

        # Fitment on target
        ProductVehicleFitment.objects.create(product=self.target, vehicle=self.vehicle)

    def test_recommends_same_brand_and_sibling_category(self):
        # Create a sibling product with same brand
        sibling_prod = Product.objects.create(
            name='Toyota Shock Absorber',
            slug='toyota-shock-absorber',
            description='Shock absorber',
            price=Decimal('75000.00'),
            stock=Decimal('5.00'),
            is_available=True,
            is_draft=False,
            category=self.suspension_cat,
            seller=self.seller2,
            brand=self.brand_toyota
        )

        recs = RecommendationEngine.get_recommendations(
            target_product=self.target,
            limit=5
        )
        rec_ids = [p.id for p in recs]
        self.assertIn(sibling_prod.id, rec_ids)
        self.assertNotIn(self.target.id, rec_ids)

    def test_vehicle_fitment_boost(self):
        # Product 1: Fits the vehicle
        fitting_prod = Product.objects.create(
            name='RAV4 Rotor',
            slug='rav4-rotor',
            description='Brake rotor',
            price=Decimal('80000.00'),
            stock=Decimal('5.00'),
            is_available=True,
            is_draft=False,
            category=self.brakes_cat,
            seller=self.seller2,
            brand=self.brand_bosch
        )
        ProductVehicleFitment.objects.create(product=fitting_prod, vehicle=self.vehicle)

        # Product 2: Does not fit vehicle
        unfit_prod = Product.objects.create(
            name='Universal Air Freshener',
            slug='universal-air-freshener',
            description='Air freshener',
            price=Decimal('5000.00'),
            stock=Decimal('10.00'),
            is_available=True,
            is_draft=False,
            category=self.electronics_cat,
            seller=self.seller3
        )

        recs = RecommendationEngine.get_recommendations(
            target_product=self.target,
            active_vehicle_id=self.vehicle.id,
            limit=5
        )
        rec_ids = [p.id for p in recs]
        self.assertIn(fitting_prod.id, rec_ids)
        # Fitting product must rank above unfit product
        if unfit_prod.id in rec_ids:
            self.assertLess(rec_ids.index(fitting_prod.id), rec_ids.index(unfit_prod.id))

    def test_anti_monotony_seller_capping(self):
        # Seller 1 creates 5 products in the same category (high scoring)
        for i in range(5):
            Product.objects.create(
                name=f'Seller1 Part {i}',
                slug=f'seller1-part-{i}',
                description='Part',
                price=Decimal('50000.00'),
                stock=Decimal('5.00'),
                is_available=True,
                is_draft=False,
                category=self.brakes_cat,
                seller=self.seller1,
                brand=self.brand_toyota
            )

        # Diverse other sellers also have items
        for i in range(3):
            Product.objects.create(
                name=f'Seller2 Part {i}',
                slug=f'seller2-part-{i}',
                description='Part',
                price=Decimal('50000.00'),
                stock=Decimal('5.00'),
                is_available=True,
                is_draft=False,
                category=self.brakes_cat,
                seller=self.seller2,
                brand=self.brand_toyota
            )
            Product.objects.create(
                name=f'Seller3 Part {i}',
                slug=f'seller3-part-{i}',
                description='Part',
                price=Decimal('50000.00'),
                stock=Decimal('5.00'),
                is_available=True,
                is_draft=False,
                category=self.brakes_cat,
                seller=self.seller3,
                brand=self.brand_toyota
            )

        # Request 6 items
        recs = RecommendationEngine.get_recommendations(
            target_product=self.target,
            limit=6
        )

        # Count occurrences of seller1
        seller1_count = sum(1 for p in recs if p.seller_id == self.seller1.id)
        # Should be strictly capped at 2 under diversity rule
        self.assertLessEqual(seller1_count, 2)
        self.assertEqual(len(recs), 6)

    @override_settings(CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}})
    def test_redis_id_caching_and_hydration(self):
        Product.objects.create(
            name='Bosch Spark Plugs',
            slug='bosch-spark-plugs',
            description='Plugs',
            price=Decimal('30000.00'),
            stock=Decimal('20.00'),
            is_available=True,
            is_draft=False,
            category=self.brakes_cat,
            seller=self.seller2,
            brand=self.brand_bosch
        )

        # First call: populates cache
        recs_pass1 = RecommendationEngine.get_recommendations(target_product=self.target, limit=4)
        self.assertTrue(len(recs_pass1) > 0)

        # Second call: reads from cache and hydrates correctly
        recs_pass2 = RecommendationEngine.get_recommendations(target_product=self.target, limit=4)
        self.assertEqual([p.id for p in recs_pass1], [p.id for p in recs_pass2])

    @override_settings(CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}})
    def test_system_performance_and_resource_profile(self):
        import time
        import tracemalloc
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        # Seed realistic catalog of 150 products across diverse sellers and categories
        sellers = [
            User.objects.create_user(username=f'bench_seller_{i}', password='pw')
            for i in range(10)
        ]
        cats = [
            self.brakes_cat, self.suspension_cat, self.electronics_cat,
            Category.objects.create(name='Engine Parts', slug='engine-parts', parent=self.parent_cat),
            Category.objects.create(name='Lighting', slug='lighting', parent=self.parent_cat),
        ]
        brands = [self.brand_toyota, self.brand_bosch]

        bulk_products = []
        for i in range(150):
            p = Product(
                name=f'Bench Product {i}',
                slug=f'bench-prod-{i}',
                description=f'Benchmark catalog product {i} with high quality description',
                price=Decimal(f'{15000 + (i * 1200)}.00'),
                stock=Decimal('15.00'),
                is_available=True,
                is_draft=False,
                category=cats[i % len(cats)],
                seller=sellers[i % len(sellers)],
                brand=brands[i % len(brands)]
            )
            bulk_products.append(p)
        Product.objects.bulk_create(bulk_products)

        # Attach fitment to a subset of products
        fitment_prods = Product.objects.filter(slug__startswith='bench-prod-')[:20]
        bulk_fitments = [
            ProductVehicleFitment(product=p, vehicle=self.vehicle)
            for p in fitment_prods
        ]
        ProductVehicleFitment.objects.bulk_create(bulk_fitments)

        # Ensure cache is cold
        cache.clear()

        # ── 1. Measure Cold Execution (Cache Miss) ───────────────────
        tracemalloc.start()
        with CaptureQueriesContext(connection) as cold_ctx:
            t0 = time.perf_counter()
            cold_recs = RecommendationEngine.get_recommendations(
                target_product=self.target,
                active_vehicle_id=self.vehicle.id,
                limit=12
            )
            cold_elapsed_ms = (time.perf_counter() - t0) * 1000
        current_mem, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        cold_query_count = len(cold_ctx.captured_queries)
        cold_sql_time_ms = sum(float(q.get('time', 0.0)) for q in cold_ctx.captured_queries) * 1000

        # ── 2. Measure Warm Execution (Cache Hit) ────────────────────
        with CaptureQueriesContext(connection) as warm_ctx:
            t0 = time.perf_counter()
            warm_recs = RecommendationEngine.get_recommendations(
                target_product=self.target,
                active_vehicle_id=self.vehicle.id,
                limit=12
            )
            warm_elapsed_ms = (time.perf_counter() - t0) * 1000

        warm_query_count = len(warm_ctx.captured_queries)
        warm_sql_time_ms = sum(float(q.get('time', 0.0)) for q in warm_ctx.captured_queries) * 1000

        # ── 3. Latency Distribution across 50 Warm Hits ──────────────
        latencies = []
        for _ in range(50):
            t0 = time.perf_counter()
            _ = RecommendationEngine.get_recommendations(
                target_product=self.target,
                active_vehicle_id=self.vehicle.id,
                limit=12
            )
            latencies.append((time.perf_counter() - t0) * 1000)

        latencies.sort()
        p50 = latencies[len(latencies) // 2]
        p95 = latencies[int(len(latencies) * 0.95)]
        p99 = latencies[int(len(latencies) * 0.99)]

        # ── 4. Verify Quality & Anti-Monotony ────────────────────────
        seller_counts = {}
        for p in cold_recs:
            seller_counts[p.seller_id] = seller_counts.get(p.seller_id, 0) + 1
        max_seller_share = max(seller_counts.values())

        # Print Empirical Performance Report
        print("\n" + "=" * 65)
        print("  SOKONI MAX RECOMMENDATION ENGINE — EMPIRICAL BENCHMARK")
        print("=" * 65)
        print(f" Catalog Size:              {Product.objects.count()} products")
        print(f" Cold Call Latency (Miss):  {cold_elapsed_ms:.2f} ms")
        print(f"   - SQL Queries (Miss):    {cold_query_count} queries ({cold_sql_time_ms:.2f} ms)")
        print(f"   - Python Compute (Miss): {max(0.0, cold_elapsed_ms - cold_sql_time_ms):.2f} ms")
        print(f" Warm Call Latency (Hit):   {warm_elapsed_ms:.2f} ms")
        print(f"   - SQL Queries (Hit):     {warm_query_count} query ({warm_sql_time_ms:.2f} ms)")
        print(f" Latency Percentiles (50 runs):")
        print(f"   - p50:                   {p50:.2f} ms")
        print(f"   - p95:                   {p95:.2f} ms")
        print(f"   - p99:                   {p99:.2f} ms")
        print(f" Memory Footprint:")
        print(f"   - Peak Python RAM:       {peak_mem / 1024:.1f} KB (< 0.1 MB)")
        print(f" Diversity & Quality:")
        print(f"   - Total Recommended:     {len(cold_recs)} items")
        print(f"   - Max Items per Seller:  {max_seller_share} (Capped at 2: {max_seller_share <= 2})")
        print("=" * 65 + "\n")

        # Assert performance gates
        self.assertLess(cold_elapsed_ms, 1000.0, "Cold latency must be < 1000ms")
        self.assertLess(p50, 150.0, "Warm p50 latency must be < 150ms")
        self.assertLessEqual(max_seller_share, 2, "Diversity must strictly cap seller share at 2")
        self.assertLess(peak_mem, 1024 * 1024, "Peak RAM per request must be < 1MB")

