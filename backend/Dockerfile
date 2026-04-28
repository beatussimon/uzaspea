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
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /install /usr/local
COPY . .
# FIX DEVOPS-09,10: do NOT collectstatic or migrate at build time (no DB/env available)
# These run at container startup via compose command
EXPOSE 8000
# FIX DEVOPS-01: daphne for WebSocket support
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "uzachuo.asgi:application"]
