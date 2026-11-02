#!/usr/bin/env python3
"""
SokoniMax Performance & Concurrency Benchmark Harness
Tests API latency, caching efficiency, and concurrency resilience under load.
"""
import time
import statistics
import concurrent.futures
import requests

BASE_URL = "http://127.0.0.1:8000"

def benchmark_endpoint(url, num_requests=30, concurrency=10, name=None):
    label = name or url
    print(f"\n--- Benchmarking: {label} ({num_requests} requests, concurrency={concurrency}) ---")
    latencies = []
    status_codes = {}

    def fetch_url(req_id):
        start = time.perf_counter()
        try:
            res = requests.get(url, timeout=10)
            elapsed = (time.perf_counter() - start) * 1000 # ms
            return res.status_code, elapsed
        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            return f"ERR:{type(e).__name__}", elapsed

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(fetch_url, i) for i in range(num_requests)]
        for f in concurrent.futures.as_completed(futures):
            code, elapsed = f.result()
            latencies.append(elapsed)
            status_codes[code] = status_codes.get(code, 0) + 1

    latencies.sort()
    avg_ms = statistics.mean(latencies)
    median_ms = statistics.median(latencies)
    p95_ms = latencies[int(len(latencies) * 0.95)] if latencies else 0
    min_ms = min(latencies) if latencies else 0
    max_ms = max(latencies) if latencies else 0

    print(f"  Status codes: {status_codes}")
    print(f"  Min: {min_ms:.1f}ms | Median: {median_ms:.1f}ms | Avg: {avg_ms:.1f}ms | P95: {p95_ms:.1f}ms | Max: {max_ms:.1f}ms")
    return {
        "label": label,
        "avg": avg_ms,
        "p95": p95_ms,
        "status_codes": status_codes
    }

if __name__ == "__main__":
    print("SokoniMax Performance Benchmark Suite")
    print(f"Target: {BASE_URL}")
    
    # 1. Categories (should hit cache)
    benchmark_endpoint(f"{BASE_URL}/api/categories/", num_requests=40, concurrency=10, name="Categories List")

    # 2. Trending Analytics
    benchmark_endpoint(f"{BASE_URL}/api/analytics/trending/", num_requests=40, concurrency=10, name="Trending Analytics")

    # 3. Product Catalog (Card List)
    benchmark_endpoint(f"{BASE_URL}/api/products/?page=1&page_size=16", num_requests=30, concurrency=6, name="Product Catalog Feed")

    print("\nBenchmark completed successfully.")
