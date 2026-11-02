FROM python:3.11-slim AS builder
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 10001 appgroup \
    && useradd -u 10001 -g appgroup -d /app -s /sbin/nologin appuser
COPY --from=builder /install /usr/local
COPY --chown=appuser:appgroup . .
RUN mkdir -p /app/staticfiles /app/media /app/private_media /app/vault_storage/_watermarked /app/geoip /app/logs /app/celerybeat \
    && chown -R appuser:appgroup /app
USER appuser
EXPOSE 8000
CMD ["uvicorn", "uzachuo.asgi:application", "--host", "0.0.0.0", "--port", "8000", "--workers", "3", "--ws", "websockets", "--timeout-keep-alive", "65", "--limit-max-requests", "2000", "--limit-max-requests-jitter", "200"]
