import base64
import io
import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from transformers import AutoImageProcessor, AutoModelForImageClassification

MODEL_NAME = "dima806/deepfake_vs_real_image_detection"
MODEL_CACHE_DIR = "/app/model-cache"
MAX_FRAMES = 10
IMAGE_SIZE = 224

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("deepfake-service")

app_state: dict[str, Any] = {
    "processor": None,
    "model": None,
    "device": torch.device("cuda" if torch.cuda.is_available() else "cpu"),
    "face_cascade": None,
}


def _load_face_cascade() -> cv2.CascadeClassifier:
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascade = cv2.CascadeClassifier(cascade_path)
    if cascade.empty():
        raise RuntimeError(f"Unable to load Haar cascade from {cascade_path}")
    return cascade


def _load_model() -> None:
    processor = AutoImageProcessor.from_pretrained(MODEL_NAME, cache_dir=MODEL_CACHE_DIR)
    model = AutoModelForImageClassification.from_pretrained(MODEL_NAME, cache_dir=MODEL_CACHE_DIR)
    model.to(app_state["device"])
    model.eval()
    app_state["processor"] = processor
    app_state["model"] = model
    app_state["face_cascade"] = _load_face_cascade()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        os.makedirs(MODEL_CACHE_DIR, exist_ok=True)
        logger.info("Loading model %s into %s", MODEL_NAME, MODEL_CACHE_DIR)
        _load_model()
        logger.info("Model and processor ready")
    except Exception:
        logger.exception("Model startup failed")
    yield


app = FastAPI(lifespan=lifespan)


def _sample_frame_indices(total_frames: int, max_frames: int) -> list[int]:
    if total_frames <= 0:
        return []
    if total_frames <= max_frames:
        return list(range(total_frames))
    return np.linspace(0, total_frames - 1, num=max_frames, dtype=int).tolist()


def _crop_face_with_margin(frame_rgb: np.ndarray) -> tuple[np.ndarray, bool]:
    gray = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2GRAY)
    faces = app_state["face_cascade"].detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
    )
    if len(faces) == 0:
        return frame_rgb, False

    x, y, w, h = max(faces, key=lambda box: box[2] * box[3])
    margin_x = int(w * 0.2)
    margin_y = int(h * 0.2)

    x1 = max(0, x - margin_x)
    y1 = max(0, y - margin_y)
    x2 = min(frame_rgb.shape[1], x + w + margin_x)
    y2 = min(frame_rgb.shape[0], y + h + margin_y)
    return frame_rgb[y1:y2, x1:x2], True


def _prepare_model_input(image_rgb: np.ndarray) -> dict[str, torch.Tensor]:
    resized = cv2.resize(image_rgb, (IMAGE_SIZE, IMAGE_SIZE), interpolation=cv2.INTER_AREA)
    pil_image = Image.fromarray(resized)
    model_inputs = app_state["processor"](images=pil_image, return_tensors="pt")
    model_inputs = {k: v.to(app_state["device"]) for k, v in model_inputs.items()}
    return model_inputs


def _fake_probability(logits: torch.Tensor) -> float:
    model = app_state["model"]
    probs = torch.softmax(logits, dim=-1)[0]
    fake_index: Optional[int] = None
    id2label = getattr(model.config, "id2label", {}) or {}

    for idx, label in id2label.items():
        if "fake" in str(label).lower():
            fake_index = int(idx)
            break

    if fake_index is None:
        fake_index = int(torch.argmax(probs).item())
    return float(probs[fake_index].item())


def _get_vision_encoder(model: torch.nn.Module) -> torch.nn.Module:
    for attr in ("base_model", "vit", "convnext", "swin", "beit", "deit", "backbone"):
        if hasattr(model, attr):
            return getattr(model, attr)
    return model


def _find_last_conv_layer(module: torch.nn.Module) -> torch.nn.Module:
    last_conv = None
    for child in module.modules():
        if isinstance(child, torch.nn.Conv2d):
            last_conv = child
    if last_conv is None:
        raise RuntimeError("No Conv2d layer found for Grad-CAM target layer")
    return last_conv


def _build_gradcam_overlay(image_rgb: np.ndarray) -> str:
    model = app_state["model"]
    vision_encoder = _get_vision_encoder(model)
    target_layer = _find_last_conv_layer(vision_encoder)
    model_inputs = _prepare_model_input(image_rgb)
    input_tensor = model_inputs["pixel_values"]

    with GradCAM(model=model, target_layers=[target_layer]) as cam:
        grayscale_cam = cam(input_tensor=input_tensor)[0]

    resized_original = cv2.resize(image_rgb, (IMAGE_SIZE, IMAGE_SIZE), interpolation=cv2.INTER_AREA)
    normalized = resized_original.astype(np.float32) / 255.0
    visualization = show_cam_on_image(normalized, grayscale_cam, use_rgb=True)
    result_image = Image.fromarray(visualization)
    buffer = io.BytesIO()
    result_image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _collect_frame_data(video_path: str) -> tuple[list[float], int, np.ndarray]:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError("Unable to open uploaded video")

    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    indices = _sample_frame_indices(frame_count, MAX_FRAMES)
    if not indices:
        cap.release()
        raise RuntimeError("Video has no readable frames")

    frame_scores: list[float] = []
    faces_detected = 0
    best_score = -1.0
    best_frame: Optional[np.ndarray] = None

    try:
        for frame_idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ok, bgr_frame = cap.read()
            if not ok or bgr_frame is None:
                continue

            rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
            crop, detected = _crop_face_with_margin(rgb_frame)
            faces_detected += int(detected)

            model_inputs = _prepare_model_input(crop)
            with torch.no_grad():
                outputs = app_state["model"](**model_inputs)

            score = _fake_probability(outputs.logits)
            frame_scores.append(score)

            if score > best_score:
                best_score = score
                best_frame = rgb_frame
    finally:
        cap.release()

    if not frame_scores or best_frame is None:
        raise RuntimeError("No frames could be analyzed from the uploaded video")

    return frame_scores, faces_detected, best_frame


@app.get("/health")
def health_check() -> dict[str, Any]:
    loaded = app_state["model"] is not None and app_state["processor"] is not None
    return {"status": "ok" if loaded else "degraded", "model_loaded": loaded}


@app.post("/predict")
async def predict(video: UploadFile = File(...)) -> dict[str, Any]:
    if app_state["model"] is None or app_state["processor"] is None:
        raise HTTPException(status_code=500, detail="Model is not loaded yet")

    extension = Path(video.filename or "").suffix or ".mp4"
    temp_path = f"/tmp/{uuid.uuid4().hex}{extension}"

    try:
        content = await video.read()
        if not content:
            raise RuntimeError("Uploaded video is empty")

        with open(temp_path, "wb") as temp_file:
            temp_file.write(content)

        frame_scores, faces_detected, best_frame = _collect_frame_data(temp_path)
        confidence_mean = float(np.mean(frame_scores))
        confidence_std = float(np.std(frame_scores))
        gradcam_base64 = _build_gradcam_overlay(best_frame)

        logger.info(
            "Prediction complete: frames=%d mean=%.4f std=%.4f faces=%d",
            len(frame_scores),
            confidence_mean,
            confidence_std,
            faces_detected,
        )

        return {
            "frame_scores": frame_scores,
            "aggregated_confidence": confidence_mean,
            "score_std": confidence_std,
            "frames_analyzed": len(frame_scores),
            "faces_detected": faces_detected,
            "gradcam_base64": gradcam_base64,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Prediction failed")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            logger.exception("Failed to clean up temporary file %s", temp_path)
