# --- Build Stage ---
FROM python:3.11-slim as builder

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- Runtime Stage ---
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . .

# Ensure static files directory exists and collect static
RUN mkdir -p static_collected
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

CMD ["gunicorn", "uzachuo.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
