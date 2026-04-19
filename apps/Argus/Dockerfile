FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
# Ensure you map your config and keypair via volumes in production
COPY . /app/apps/Argus

# Set Python path so imports work
ENV PYTHONPATH="/"

EXPOSE 8100

CMD ["python", "-m", "apps.Argus.core"]
