import os
import uuid
import logging
import cv2
import numpy as np
import base64
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import torch
from transformers import AutoImageProcessor, AutoModelForImageClassification
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
import tempfile

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MODEL_NAME = "dima806/deepfake_vs_real_image_detection"
CACHE_DIR = "/app/model-cache"

app = FastAPI()

processor = None
model = None
model_loaded = False
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

@app.on_event("startup")
async def startup_event():
    global processor, model, model_loaded
    try:
        logger.info(f"Loading model {MODEL_NAME}...")
        os.makedirs(CACHE_DIR, exist_ok=True)
        processor = AutoImageProcessor.from_pretrained(MODEL_NAME, cache_dir=CACHE_DIR)
        model = AutoModelForImageClassification.from_pretrained(MODEL_NAME, cache_dir=CACHE_DIR)
        model.eval()
        model_loaded = True
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model_loaded}

# Wrapper to output logits
class WrapperModel(torch.nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m
    def forward(self, x):
        return self.m(x).logits

@app.post("/predict")
async def predict(video: UploadFile = File(...)):
    if not model_loaded:
        return JSONResponse(status_code=500, content={"message": "Model not loaded correctly"})
    
    tmp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}_{video.filename}")
    try:
        with open(tmp_path, "wb") as f:
            f.write(await video.read())
        
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise Exception("Failed to open video file")
            
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if frame_count <= 0:
            raise Exception("Video has no frames")
            
        num_samples = min(10, frame_count)
        indices = np.linspace(0, frame_count - 1, num_samples, dtype=int)
        
        frames = []
        original_crops = []
        faces_detected = 0
        
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret or frame is None:
                continue
                
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            gray = cv2.cvtColor(rgb_frame, cv2.COLOR_RGB2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            
            if len(faces) > 0:
                faces_detected += 1
                x, y, w, h = faces[0]
                margin_x = int(w * 0.2)
                margin_y = int(h * 0.2)
                
                x1 = max(0, x - margin_x)
                y1 = max(0, y - margin_y)
                x2 = min(rgb_frame.shape[1], x + w + margin_x)
                y2 = min(rgb_frame.shape[0], y + h + margin_y)
                
                cropped = rgb_frame[y1:y2, x1:x2]
            else:
                cropped = rgb_frame
                
            resized = cv2.resize(cropped, (224, 224))
            frames.append(resized)
            original_crops.append(cv2.resize(cropped, (224, 224)))
            
        cap.release()
        
        if len(frames) == 0:
            raise Exception("No valid frames extracted")
            
        inputs = processor(images=frames, return_tensors="pt")
        
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
            probs = torch.nn.functional.softmax(logits, dim=-1)
            
        fake_idx = None
        for k, v in model.config.id2label.items():
            if "fake" in v.lower():
                fake_idx = k
                break
        if fake_idx is None:
            fake_idx = 0 
            
        frame_scores = probs[:, fake_idx].tolist()
        mean_conf = float(np.mean(frame_scores))
        std_conf = float(np.std(frame_scores)) if len(frame_scores) > 1 else 0.0
        
        max_idx = np.argmax(frame_scores)
        best_frame_input = inputs["pixel_values"][max_idx:max_idx+1]
        best_original = original_crops[max_idx]
        
        target_layers = []
        for m_layer in model.modules():
            if isinstance(m_layer, torch.nn.Conv2d):
                target_layers = [m_layer]
                
        gradcam_base64 = ""
        if target_layers:
            wrapped = WrapperModel(model)
            try:
                # Need to use 'reshape_transform' for ViT model, even on patch embeddings sometimes,
                # but if that target layer outputs a 2D map, GradCAM will just use it directly.
                # Actually, some ViT block requires reshapes but if we specifically captured Conv2d, no reshape is needed!
                cam = GradCAM(model=wrapped, target_layers=target_layers)
                grayscale_cam = cam(input_tensor=best_frame_input, targets=None)
                grayscale_cam = grayscale_cam[0, :]
                
                rgb_img = best_original.astype(np.float32) / 255.0
                cam_image = show_cam_on_image(rgb_img, grayscale_cam, use_rgb=True)
                
                cam_image_bgr = cv2.cvtColor(cam_image, cv2.COLOR_RGB2BGR)
                _, buffer = cv2.imencode('.png', cam_image_bgr)
                gradcam_base64 = base64.b64encode(buffer).decode('utf-8')
            except Exception as cam_err:
                logger.error(f"GradCAM failed: {cam_err}")
                
        return {
            "frame_scores": frame_scores,
            "aggregated_confidence": mean_conf,
            "score_std": std_conf,
            "frames_analyzed": len(frames),
            "faces_detected": faces_detected,
            "gradcam_base64": gradcam_base64
        }
        
    except Exception as e:
        logger.error(f"Error during predict: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"message": str(e)})
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
