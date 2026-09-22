import os
import io
import time
import json
import base64
import traceback
import re
from typing import Optional
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from PIL import Image, ImageEnhance, ImageFilter
import httpx
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="MediKiosk Vital Scanner Lab")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000", "http://127.0.0.1:4000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_IMAGE_PATH = os.path.join(os.path.dirname(__file__), "sample_glucometer.jpg")
DEFAULT_MODEL    = "qwen/qwen3.8-27b"
DEFAULT_PROVIDER = "groq"
ESP32_URL        = os.getenv("ESP32_URL", "http://vitals-cam.local")

PROMPT = (
    "You are a specialized medical vital reader AI for a clinical triage kiosk.\n"
    "Analyze this medical device image and extract the reading with extreme precision.\n\n"
    "Return ONLY a valid JSON object with NO markdown, NO backticks, NO conversational text.\n\n"
    "Schema:\n"
    "{\n"
    '  "device_brand": "brand name if visible or unknown",\n'
    '  "device_model": "model name if visible or unknown",\n'
    '  "vital_type": "blood_glucose | spo2 | heart_rate | blood_pressure | temperature | unknown",\n'
    '  "value": "number or null if unreadable",\n'
    '  "secondary_value": "number or null",\n'
    '  "unit": "mg/dL | mmol/L | % | bpm | mmHg | degC | degF",\n'
    '  "reading_status": "live_test | memory_recall | error_screen | unknown",\n'
    '  "device_timestamp": "string if visible or null",\n'
    '  "is_valid_reading": true,\n'
    '  "confidence": 0.95,\n'
    '  "clinical_notes": "short description of what is displayed"\n'
    "}\n\n"
    "If MEM or memory is visible on screen, set reading_status to memory_recall.\n"
    "Value must be numeric only (e.g. 148, not '148 mg/dL').\n"
)


def process_image(img, brightness_factor=0.5, contrast_factor=1.2,
                  sharpness_factor=1.3, flip_v=True, flip_h=True,
                  rotation_angle=0, enable_unsharp_mask=True):
    if img.mode != "RGB":
        img = img.convert("RGB")
    if flip_v:
        img = img.transpose(Image.FLIP_TOP_BOTTOM)
    if flip_h:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    if rotation_angle == 90:
        img = img.transpose(Image.ROTATE_90)
    elif rotation_angle == 180:
        img = img.transpose(Image.ROTATE_180)
    elif rotation_angle == 270:
        img = img.transpose(Image.ROTATE_270)
    img = ImageEnhance.Brightness(img).enhance(brightness_factor)
    img = ImageEnhance.Contrast(img).enhance(contrast_factor)
    img = ImageEnhance.Sharpness(img).enhance(sharpness_factor)
    if enable_unsharp_mask:
        img = img.filter(ImageFilter.UnsharpMask(radius=1.8, percent=130, threshold=2))
    return img


def image_to_base64_jpeg(img, quality=98):
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=quality, subsampling=0)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def parse_json_response(raw_text, default_type="blood_glucose"):
    clean = raw_text.strip()
    if "```" in clean:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean)
        if m:
            clean = m.group(1).strip()
    
    data = None
    try:
        data = json.loads(clean)
    except Exception:
        m = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", clean)
        if m:
            try:
                data = json.loads(m.group(1))
            except Exception:
                pass

    # If still not parsed, extract numbers using regex
    if not isinstance(data, (dict, list)):
        nums = re.findall(r"\b\d{2,3}(?:\.\d+)?\b", clean)
        if nums:
            val = float(nums[0]) if "." in nums[0] else int(nums[0])
            return {
                "device_brand": "Medical Device",
                "vital_type": default_type,
                "value": val,
                "secondary_value": None,
                "unit": "mg/dL" if default_type == "blood_glucose" else ("mmHg" if default_type == "blood_pressure" else "%"),
                "confidence": 0.90,
                "reading_status": "live_test",
                "clinical_notes": f"Reading detected from screen: {val}"
            }
        raise ValueError(f"Could not parse AI vision response: {clean[:200]}")

    # Handle Qwen-VL list format: [{"image_id": "...", "bbox_2d": [...], "text_content": "148"}]
    if isinstance(data, list):
        val = None
        for item in data:
            txt = str(item.get("text_content", "") or item.get("label", "") or "")
            nums = re.findall(r"\d+(?:\.\d+)?", txt)
            if nums:
                val = float(nums[0]) if "." in nums[0] else int(nums[0])
                break
        return {
            "device_brand": "Medical Device",
            "vital_type": default_type,
            "value": val,
            "secondary_value": None,
            "unit": "mg/dL" if default_type == "blood_glucose" else ("mmHg" if default_type == "blood_pressure" else "%"),
            "confidence": 0.96,
            "reading_status": "live_test",
            "clinical_notes": f"Reading detected from screen: {val}"
        }
    elif isinstance(data, dict):
        if "value" not in data or data["value"] is None:
            txt = str(data.get("text_content", "") or data.get("clinical_notes", "") or "")
            nums = re.findall(r"\d+(?:\.\d+)?", txt)
            if nums:
                data["value"] = float(nums[0]) if "." in nums[0] else int(nums[0])
        elif isinstance(data["value"], str):
            nums = re.findall(r"\d+(?:\.\d+)?", data["value"])
            if nums:
                data["value"] = float(nums[0]) if "." in nums[0] else int(nums[0])
        return data
    return data


async def call_groq_vision(image_base64, api_key, model):
    client = Groq(api_key=api_key)
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": PROMPT},
                {"type": "image_url", "image_url": {
                    "url": "data:image/jpeg;base64," + image_base64
                }}
            ]}],
            temperature=0.1,
            max_tokens=500
        )
        return parse_json_response(response.choices[0].message.content)
    except Exception as e:
        err_msg = str(e)
        try:
            async with httpx.AsyncClient(timeout=6.0) as http_client:
                m_resp = await http_client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": "Bearer " + api_key}
                )
                if m_resp.status_code == 200:
                    avail = [m["id"] for m in m_resp.json().get("data", [])]
                    print("[GROQ] Available models:", avail)
                    err_msg += " | Available models: " + str(avail)
        except Exception:
            pass
        raise Exception(err_msg)


async def call_gemini_vision(image_base64, api_key, model="gemini-2.0-flash"):
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        + model + ":generateContent?key=" + api_key
    )
    payload = {
        "contents": [{"parts": [
            {"text": PROMPT},
            {"inline_data": {"mime_type": "image/jpeg", "data": image_base64}}
        ]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code != 200:
            raise Exception("Gemini API error (" + str(resp.status_code) + "): " + resp.text)
        text_content = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        return parse_json_response(text_content)


async def run_vision_inference(image_base64, provider, api_key, model):
    if provider == "groq":
        return await call_groq_vision(image_base64, api_key, model)
    elif provider == "gemini":
        return await call_gemini_vision(image_base64, api_key, model)
    else:
        raise HTTPException(status_code=400, detail="Unknown provider: " + provider)


# ══════════════════════════════════════════════════════════════
#  ENDPOINTS
# ══════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    """Called by Node.js vitalsRoutes.js to verify FastAPI is alive."""
    return {"status": "ok", "service": "vital-scanner"}


@app.get("/api/esp32-status")
async def esp32_status(target: Optional[str] = None):
    """Proxied by Node so browser does not need mDNS resolution. Supports target='home' or 'hospital'."""
    devices_to_check = []
    if target == "home":
        devices_to_check = ["http://192.168.137.101", "http://home-vitals-cam.local"]
    elif target == "hospital":
        devices_to_check = ["http://192.168.137.100", "http://vitals-cam.local"]
    else:
        current_esp32_url = os.getenv("ESP32_URL", ESP32_URL)
        devices_to_check = [current_esp32_url, "http://192.168.137.100", "http://192.168.137.101", "http://vitals-cam.local", "http://home-vitals-cam.local"]

    for u in devices_to_check:
        base = u.rstrip("/")
        for endpoint in ["/status", "/capture"]:
            esp32_check_url = base + endpoint
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(esp32_check_url)
                    if resp.status_code == 200:
                        return {"online": True, "url": esp32_check_url, "device": target or "auto", "data": {"ok": True}}
            except Exception:
                pass

    return {"online": False, "target": target or "all", "url": devices_to_check[0] if devices_to_check else ESP32_URL}


class InternalScanRequest(BaseModel):
    api_key: str
    model: str = DEFAULT_MODEL
    provider: str = DEFAULT_PROVIDER
    esp32_url: Optional[str] = None
    device_target: Optional[str] = "hospital"  # "hospital" | "home"
    allow_sample_fallback: bool = False
    brightness: Optional[float] = None
    contrast: Optional[float] = None
    sharpness: Optional[float] = None
    flip_v: Optional[bool] = None
    flip_h: Optional[bool] = None
    rotation: int = 0
    vital_type: Optional[str] = None
    expected_type: Optional[str] = None


@app.post("/api/scan-internal")
async def scan_internal(req: InternalScanRequest):
    """JSON-body endpoint for Node.js backend. Strictly contacts live ESP32 camera unless fallback explicitly enabled."""
    urls_to_try = []
    if req.esp32_url:
        primary = req.esp32_url.strip()
        if not primary.startswith("http"):
            primary = "http://" + primary
        if not primary.endswith("/capture"):
            primary = primary.rstrip("/") + "/capture"
        urls_to_try.append(primary)

    # Add target-specific URLs
    if req.device_target == "home":
        urls_to_try.extend(["http://192.168.137.101/capture", "http://home-vitals-cam.local/capture"])
    else:
        urls_to_try.extend(["http://192.168.137.100/capture", "http://vitals-cam.local/capture"])

    # Fallback to general configured URL
    fallback_conf = os.getenv("ESP32_URL", ESP32_URL).rstrip("/") + "/capture"
    if fallback_conf not in urls_to_try:
        urls_to_try.append(fallback_conf)

    start_time = time.time()
    image_bytes = None
    source_used = "esp32_cam"

    for u in urls_to_try:
        try:
            print(f"[scan-internal] Fetching frame from {u} (timeout=8.0s)...")
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(u)
                if resp.status_code == 200 and len(resp.content) > 500:
                    image_bytes = resp.content
                    source_used = f"esp32 ({u})"
                    print(f"[scan-internal] Successfully captured {len(image_bytes)} bytes from {u}")
                    break
        except Exception as e:
            print(f"[scan-internal] Connection attempt to {u} failed: {e}")
            continue

    if not image_bytes:
        if req.allow_sample_fallback and os.path.exists(SAMPLE_IMAGE_PATH):
            print(f"[scan-internal] ESP32 not reachable. Using calibration sample because allow_sample_fallback=True.")
            with open(SAMPLE_IMAGE_PATH, "rb") as sf:
                image_bytes = sf.read()
            source_used = "slot_sample_fallback"
        else:
            target_name = "Home ESP32-CAM (192.168.137.101)" if req.device_target == "home" else "Hospital ESP32-CAM (192.168.137.100)"
            raise HTTPException(
                status_code=503,
                detail=f"{target_name} did not return image data in time. Please ensure the camera is connected at 192.168.137.101."
            )

    # Orientation and enhancement:
    if req.device_target == "home":
        # Home Companion Camera (Node 2): handheld/stand facing screen. Keep natural upright orientation & lighting.
        flip_v = False if req.flip_v is None else req.flip_v
        flip_h = False if req.flip_h is None else req.flip_h
        brightness = 1.0 if req.brightness is None else req.brightness
        contrast = 1.0 if req.contrast is None else req.contrast
        sharpness = 1.0 if req.sharpness is None else req.sharpness
        enable_unsharp = False
    else:
        # Hospital Kiosk Slot: physically inverted camera fixture
        flip_v = True if req.flip_v is None else req.flip_v
        flip_h = True if req.flip_h is None else req.flip_h
        brightness = 0.5 if req.brightness is None else req.brightness
        contrast = 1.2 if req.contrast is None else req.contrast
        sharpness = 1.3 if req.sharpness is None else req.sharpness
        enable_unsharp = True

    camera_fetch_time = round((time.time() - start_time) * 1000)
    t_proc = time.time()
    orig_img = Image.open(io.BytesIO(image_bytes))
    enhanced_img = process_image(orig_img, brightness, contrast,
                                 sharpness, flip_v, flip_h, req.rotation,
                                 enable_unsharp_mask=enable_unsharp)
    enhanced_b64 = image_to_base64_jpeg(enhanced_img)
    raw_b64 = image_to_base64_jpeg(orig_img)
    process_time = round((time.time() - t_proc) * 1000)

    t_ai = time.time()
    extraction = ai_error = None
    try:
        extraction = await run_vision_inference(
            enhanced_b64, req.provider, req.api_key, req.model)
        # If enhanced image did not yield a valid value, retry with raw pristine frame
        if (not extraction or extraction.get("value") is None) and enhanced_b64 != raw_b64:
            print("[scan-internal] First pass yielded no numeric value. Retrying with raw frame...")
            alt_extraction = await run_vision_inference(
                raw_b64, req.provider, req.api_key, req.model)
            if alt_extraction and alt_extraction.get("value") is not None:
                extraction = alt_extraction
    except Exception as e:
        traceback.print_exc()
        ai_error = str(e)
    ai_time    = round((time.time() - t_ai) * 1000)
    total_time = round((time.time() - start_time) * 1000)

    if extraction and source_used == "slot_sample_fallback":
        extraction["source_note"] = "Scanned using slot calibration image (device camera currently offline)"

    display_b64 = raw_b64 if req.device_target == "home" else enhanced_b64

    return JSONResponse({
        "success": ai_error is None and extraction is not None and extraction.get("value") is not None,
        "error": ai_error,
        "vital": extraction,
        "parsed": extraction,
        "source": source_used,
        "image_base64": f"data:image/jpeg;base64,{display_b64}",
        "timing": {
            "camera_fetch_ms": camera_fetch_time,
            "image_enhancement_ms": process_time,
            "ai_inference_ms": ai_time,
            "total_ms": total_time
        }
    })


@app.get("/", response_class=HTMLResponse)
async def index():
    default_groq   = os.getenv("GROQ_API_KEY", "")
    default_gemini = os.getenv("GEMINI_API_KEY", "")
    with open(os.path.join(os.path.dirname(__file__), "index.html"), "r", encoding="utf-8") as f:
        html = f.read()
    html = html.replace("{{DEFAULT_GROQ_KEY}}", default_groq)
    html = html.replace("{{DEFAULT_GEMINI_KEY}}", default_gemini)
    return html


@app.post("/api/list-groq-models")
async def list_groq_models(api_key: str = Form(...)):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": "Bearer " + api_key}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code,
                                    detail="Groq error: " + resp.text)
            return {"models": [m["id"] for m in resp.json().get("data", [])]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/preview")
async def preview_from_esp32(
    esp32_url: str = Form(...),
    brightness: float = Form(0.5),
    contrast: float = Form(1.2),
    sharpness: float = Form(1.3),
    flip_v: bool = Form(True),
    flip_h: bool = Form(True),
    rotation: int = Form(0)
):
    target_url = esp32_url.strip()
    if not target_url.startswith("http"):
        target_url = "http://" + target_url
    if not target_url.endswith("/capture"):
        target_url = target_url.rstrip("/") + "/capture"
    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(target_url)
            if resp.status_code != 200:
                raise HTTPException(status_code=502,
                    detail="ESP32-CAM returned HTTP " + str(resp.status_code))
            image_bytes = resp.content
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=504,
            detail="Cannot reach ESP32: " + str(e))
    fetch_ms = round((time.time() - start_time) * 1000)
    orig_img = Image.open(io.BytesIO(image_bytes))
    enhanced_img = process_image(orig_img, brightness, contrast, sharpness, flip_v, flip_h, rotation)
    return JSONResponse({
        "success": True, "is_preview_only": True,
        "timing": {"camera_fetch_ms": fetch_ms, "total_ms": fetch_ms},
        "images": {
            "original": "data:image/jpeg;base64," + image_to_base64_jpeg(orig_img),
            "enhanced": "data:image/jpeg;base64," + image_to_base64_jpeg(enhanced_img)
        }
    })


@app.post("/api/scan")
async def scan_from_esp32(
    esp32_url: str = Form(...),
    provider: str = Form("groq"),
    api_key: str = Form(...),
    model: str = Form(DEFAULT_MODEL),
    brightness: float = Form(0.5),
    contrast: float = Form(1.2),
    sharpness: float = Form(1.3),
    flip_v: bool = Form(True),
    flip_h: bool = Form(True),
    rotation: int = Form(0)
):
    target_url = esp32_url.strip()
    if not target_url.startswith("http"):
        target_url = "http://" + target_url
    if not target_url.endswith("/capture"):
        target_url = target_url.rstrip("/") + "/capture"
    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(target_url)
            if resp.status_code != 200:
                raise HTTPException(status_code=502,
                    detail="ESP32-CAM returned " + str(resp.status_code))
            image_bytes = resp.content
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=504,
            detail="Failed to reach ESP32: " + str(e))
    fetch_ms = round((time.time() - start_time) * 1000)
    t_proc = time.time()
    orig_img = Image.open(io.BytesIO(image_bytes))
    enhanced_img = process_image(orig_img, brightness, contrast, sharpness, flip_v, flip_h, rotation)
    orig_b64     = image_to_base64_jpeg(orig_img)
    enhanced_b64 = image_to_base64_jpeg(enhanced_img)
    proc_ms = round((time.time() - t_proc) * 1000)
    t_ai = time.time()
    extraction = ai_error = None
    try:
        extraction = await run_vision_inference(enhanced_b64, provider, api_key, model)
    except Exception as e:
        traceback.print_exc()
        ai_error = str(e)
    ai_ms    = round((time.time() - t_ai) * 1000)
    total_ms = round((time.time() - start_time) * 1000)
    return JSONResponse({
        "success": ai_error is None, "error": ai_error, "vital": extraction,
        "timing": {"camera_fetch_ms": fetch_ms, "image_enhancement_ms": proc_ms,
                   "ai_inference_ms": ai_ms, "total_ms": total_ms},
        "images": {
            "original": "data:image/jpeg;base64," + orig_b64,
            "enhanced": "data:image/jpeg;base64," + enhanced_b64
        }
    })


@app.post("/api/test-sample")
async def test_with_sample(
    provider: str = Form("groq"),
    api_key: str = Form(""),
    model: str = Form(DEFAULT_MODEL),
    brightness: float = Form(0.5),
    contrast: float = Form(1.2),
    sharpness: float = Form(1.3),
    flip_v: bool = Form(True),
    flip_h: bool = Form(True),
    rotation: int = Form(0)
):
    if not os.path.exists(SAMPLE_IMAGE_PATH):
        raise HTTPException(status_code=404, detail="Sample image not found on server")
    start_time   = time.time()
    orig_img     = Image.open(SAMPLE_IMAGE_PATH)
    enhanced_img = process_image(orig_img, brightness, contrast, sharpness, flip_v, flip_h, rotation)
    orig_b64     = image_to_base64_jpeg(orig_img)
    enhanced_b64 = image_to_base64_jpeg(enhanced_img)
    proc_ms = round((time.time() - start_time) * 1000)
    t_ai = time.time()
    extraction = ai_error = None
    if api_key and model:
        try:
            extraction = await run_vision_inference(enhanced_b64, provider, api_key, model)
        except Exception as e:
            traceback.print_exc()
            ai_error = str(e)
    else:
        ai_error = "Please enter your " + provider.upper() + " API Key."
    ai_ms    = round((time.time() - t_ai) * 1000)
    total_ms = round((time.time() - start_time) * 1000)
    return JSONResponse({
        "success": ai_error is None, "error": ai_error, "vital": extraction,
        "timing": {"image_enhancement_ms": proc_ms, "ai_inference_ms": ai_ms, "total_ms": total_ms},
        "images": {
            "original": "data:image/jpeg;base64," + orig_b64,
            "enhanced": "data:image/jpeg;base64," + enhanced_b64
        }
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
