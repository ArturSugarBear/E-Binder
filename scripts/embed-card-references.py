#!/usr/bin/env python3
"""Generate card reference vectors from *licensed, local* image files.

Install offline dependencies in a separate environment:
  python -m pip install 'numpy>=1.26,<3' 'pillow>=10,<13' 'onnxruntime>=1.20,<2'

Usage:
  python scripts/embed-card-references.py image-manifest.json model.onnx embeddings.json

The image manifest is a JSON object with:
  {
    "modelId": "dinov2-small-quantized-v1",
    "preprocessing": "imagenet-meanstd-chw-stretch",
    "references": [
      {"id":"de:sv01-211","language":"de","setId":"sv01",
       "number":"211/198","path":"local-images/sv01-211.png"}
    ]
  }

All paths are local, relative to the image manifest directory; no network
request is made and original photos are not copied into the output.
"""
import json
import math
import re
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit(
            "Usage: python scripts/embed-card-references.py "
            "<image-manifest.json> <model.onnx> <vectors.json>"
        )
    try:
        import numpy as np
        import onnxruntime as ort
        from PIL import Image
    except ImportError as exc:
        raise SystemExit("Install numpy, pillow and onnxruntime first") from exc

    manifest_path = Path(sys.argv[1]).resolve()
    model_path = Path(sys.argv[2]).resolve()
    destination = Path(sys.argv[3]).resolve()
    root = manifest_path.parent
    source = json.loads(manifest_path.read_text(encoding="utf-8"))

    model_id = source.get("modelId", "")
    preproc = source.get("preprocessing", "rgb-0-1-chw-stretch")
    if not isinstance(model_id, str) or not re.fullmatch(r"[A-Za-z0-9_.-]{3,100}", model_id):
        raise ValueError("Invalid model version")
    if preproc not in ("rgb-0-1-chw-stretch", "imagenet-meanstd-chw-stretch"):
        raise ValueError("Unknown preprocessing contract")
    references = source.get("references")
    if not isinstance(references, list) or not 1 <= len(references) <= 200000:
        raise ValueError("Invalid input reference count")

    session = ort.InferenceSession(
        str(model_path),
        providers=["CPUExecutionProvider"],
        sess_options=ort.SessionOptions(),
    )
    input_meta = session.get_inputs()
    if len(input_meta) != 1:
        raise ValueError("Export a single image tensor input [1,3,224,224]")
    name = input_meta[0].name
    output_name = session.get_outputs()[0].name
    seen = set()
    result = []
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)[:, None, None]
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)[:, None, None]

    for row, item in enumerate(references):
        if not isinstance(item, dict):
            raise ValueError(f"Reference {row} must be an object")
        ref_id, language, set_id, number = (
            item.get("id"), item.get("language"), item.get("setId"), item.get("number")
        )
        if (
            not isinstance(ref_id, str)
            or not re.fullmatch(r"[A-Za-z0-9_.:+-]{3,200}", ref_id)
            or ref_id in seen
            or language not in ("de", "en", "ja")
            or not isinstance(set_id, str)
            or not re.fullmatch(r"[A-Za-z0-9_.+-]{1,100}", set_id)
            or not isinstance(number, str)
            or not re.fullmatch(r"[A-Za-z0-9 /-]{1,40}", number)
        ):
            raise ValueError(f"Invalid or duplicate printing at row {row}")
        seen.add(ref_id)
        name_path = item.get("path")
        if not isinstance(name_path, str) or not name_path or Path(name_path).is_absolute():
            raise ValueError(f"Use a local relative image path at row {row}")
        image_path = (root / name_path).resolve()
        if not image_path.is_relative_to(root) or not image_path.is_file():
            raise ValueError(f"Image path not found or outside import directory: {row}")

        with Image.open(image_path) as image:
            image = image.convert("RGB").resize((224, 224), Image.Resampling.BICUBIC)
            values = np.asarray(image, dtype=np.float32).transpose(2, 0, 1) / 255.0
        if preproc == "imagenet-meanstd-chw-stretch":
            values = (values - mean) / std
        prediction = np.asarray(
            session.run([output_name], {name: values[None, :, :, :]})[0]
        )
        if prediction.ndim == 3 and prediction.shape[0] == 1:
            vector = prediction[0, 0, :]
        elif prediction.ndim == 2 and prediction.shape[0] == 1:
            vector = prediction[0, :]
        else:
            raise ValueError("Expected [1,tokens,dimensions] or [1,dimensions] output")
        if vector.ndim != 1 or not 64 <= vector.size <= 2048:
            raise ValueError("Unexpected visual embedding dimensions")
        if not np.isfinite(vector).all() or float(np.dot(vector, vector)) <= 0:
            raise ValueError("Model returned invalid or empty embedding")
        result.append({
            "id": ref_id,
            "language": language,
            "setId": set_id,
            "number": number,
            "vector": [float(round(v, 7)) for v in vector],
        })
        if (row + 1) % 100 == 0:
            print(f"Embedded {row + 1}/{len(references)}", file=sys.stderr)

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps({"modelId": model_id, "preprocessing": preproc, "references": result},
                   ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Created {len(result)} reference vectors in {destination.name}")


if __name__ == "__main__":
    main()
