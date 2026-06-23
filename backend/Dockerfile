FROM python:3.11-slim AS builder
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 10001 appgroup \
    && useradd -u 10001 -g appgroup -d /app -s /sbin/nologin appuser
COPY --from=builder /install /usr/local
COPY --chown=appuser:appgroup . .
RUN mkdir -p /app/staticfiles /app/media && chown -R appuser:appgroup /app
USER appuser
EXPOSE 8000
# LIGHTSAIL-1GB: 1 worker for 1GB instance (docker-compose overrides this)
CMD ["uvicorn", "uzachuo.asgi:application", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--ws", "websockets"]
