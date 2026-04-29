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
EXPOSE 8000
# Default CMD — overridden by docker-compose per service
CMD ["gunicorn", "uzachuo.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
