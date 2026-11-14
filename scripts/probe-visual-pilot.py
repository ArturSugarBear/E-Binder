#!/usr/bin/env python3
"""Diagnostic only: compare local card photos against the packed pilot index.

This mirrors `searchVisualIndex()` in src/domain/visual-retrieval.ts (int8 index,
CLS token, cosine similarity, no relevance floor) using the exact model and the
exact manifest produced by `scripts/pack-visual-index.mjs`. It never uploads a
photo, never writes to the repository and makes no accuracy or confidence claim.

It exists to make the P0 finding reproducible: with the nine-card beta index,
every image - including a blank frame or a card that is not indexed - receives
five nearest neighbours. See docs/reviews/2026-11-14-scanner-dinov2-diagnosis.md.

Usage:
  python scripts/probe-visual-pilot.py \\
    <model.onnx> <public/assets/vision> <image> [<image> ...]

Dependencies (same as the offline index pipeline):
  python -m pip install 'numpy>=1.26,<3' 'pillow>=10,<13' 'onnxruntime>=1.20,<2'
"""
import json
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    try:
        import numpy as np
        import onnxruntime as ort
        from PIL import Image
    except ImportError as exc:
        raise SystemExit("Install numpy, pillow and onnxruntime first") from exc

    model_path = Path(sys.argv[1]).resolve()
    vision_dir = Path(sys.argv[2]).resolve()
    images = [Path(value).resolve() for value in sys.argv[3:]]

    manifest = json.loads((vision_dir / "manifest.json").read_text("utf-8"))
    references = json.loads(
        (vision_dir / manifest["referencesFile"]).read_text("utf-8")
    )
    dimensions = manifest["dimensions"]
    vectors = np.fromfile(
        vision_dir / manifest["indexFile"], dtype=np.int8
    ).reshape(len(references), dimensions)
    vectors = vectors.astype(np.float64)

    session = ort.InferenceSession(
        str(model_path), providers=["CPUExecutionProvider"]
    )
    input_meta = session.get_inputs()[0]
    output_name = session.get_outputs()[0].name
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)[:, None, None]
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)[:, None, None]

    def embed(path: Path):
        with Image.open(path) as image:
            image = image.convert("RGB").resize(
                (224, 224), Image.Resampling.BICUBIC
            )
            values = np.asarray(image, dtype=np.float32).transpose(2, 0, 1)
        values = values / 255.0
        if manifest["preprocessing"] == "imagenet-meanstd-chw-stretch":
            values = (values - mean) / std
        prediction = np.asarray(
            session.run([output_name], {input_meta.name: values[None]})[0]
        )
        vector = prediction[0, 0, :] if prediction.ndim == 3 else prediction[0, :]
        return vector.astype(np.float64)

    def top_five(vector):
        norm = np.linalg.norm(vector)
        ranked = []
        for row, reference in zip(vectors, references):
            row_norm = np.linalg.norm(row)
            if row_norm <= 0:
                continue
            similarity = float(np.dot(vector, row) / (norm * row_norm))
            ranked.append((similarity, reference["id"]))
        # Same deterministic Top-5 and tie-break as searchVisualIndex().
        ranked.sort(key=lambda item: (-item[0], item[1]))
        return ranked[:5]

    print(f"model   {manifest['modelId']} ({manifest['count']} references)")
    for path in images:
        print(f"\n{path.name}")
        for rank, (similarity, reference_id) in enumerate(
            top_five(embed(path)), 1
        ):
            print(f"  {rank}. {reference_id:<16} cos={similarity:+.4f}")
    print(
        "\nSimilarity is a ranking value, not a probability and not proof that"
        " the photographed printing is indexed."
    )


if __name__ == "__main__":
    main()
