FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.4.0 torchvision==0.19.0
RUN pip install --no-cache-dir -r requirements.txt

RUN python -c "from transformers import AutoModelForImageClassification, AutoImageProcessor; m='dima806/deepfake_vs_real_image_detection'; AutoModelForImageClassification.from_pretrained(m, cache_dir='/app/model-cache'); AutoImageProcessor.from_pretrained(m, cache_dir='/app/model-cache')"

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
