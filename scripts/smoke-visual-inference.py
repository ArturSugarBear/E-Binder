#!/usr/bin/env python3
"""Real DINOv2 ONNX inference smoke test, NOT a real-camera accuracy benchmark.

Uses only nine locally bundled, verified demo reference files. Runs actual
quantized model weights and searches the exact int8 index shipped to Pages.
Never downloads donor photographs or publishes private user data.
"""
import hashlib
import json
import resource
import statistics
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit(
            "Usage: python scripts/smoke-visual-inference.py "
            "<image-manifest.json> <model.onnx> <vision-dir> <report.json>"
        )
    source_path, model_path, asset_path, report_path = map(Path, sys.argv[1:])
    source = json.loads(source_path.read_text(encoding="utf-8"))
    manifest = json.loads((asset_path / "manifest.json").read_text(encoding="utf-8"))
    references = json.loads(
        (asset_path / manifest["referencesFile"]).read_text(encoding="utf-8")
    )
    assert len(references) == manifest["count"], "Reference count mismatch"
    assert len(source["references"]) == len(references), "Unexpected source coverage"
    assert source["modelId"] == manifest["modelId"], "Different model identities"
    assert source["preprocessing"] == manifest["preprocessing"], "Different preprocessing"
    assert hashlib.sha256(model_path.read_bytes()).hexdigest() == manifest["modelSha256"]
    dims = manifest["dimensions"]
    packed = np.fromfile(asset_path / manifest["indexFile"], dtype=np.int8)
    assert packed.size == len(references) * dims, "Bad packed index size"
    vectors = packed.reshape(-1, dims).astype(np.float32)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    assert np.all(norms > 0), "Empty index vector"
    vectors /= norms
    reference_ids = [ref["id"] for ref in references]
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)[:, None, None]
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)[:, None, None]

    cold_start = time.perf_counter()
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    startup_ms = (time.perf_counter() - cold_start) * 1000
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    results = []
    for ref in source["references"]:
        file = (source_path.parent / ref["path"]).resolve()
        if not file.is_relative_to(source_path.parent.resolve()) or not file.is_file():
            raise ValueError("Reference file missing or outside manifest directory")
        with Image.open(file) as image:
            image = image.convert("RGB").resize((224, 224), Image.Resampling.BICUBIC)
            values = np.asarray(image, dtype=np.float32).transpose(2, 0, 1) / 255.0
        if manifest["preprocessing"] == "imagenet-meanstd-chw-stretch":
            values = (values - mean) / std
        started = time.perf_counter()
        output = np.asarray(
            session.run([output_name], {input_name: values[None, :, :, :]})[0]
        )
        latency_ms = (time.perf_counter() - started) * 1000
        if output.ndim == 3:
            embedding = output[0, 0, :]
        elif output.ndim == 2:
            embedding = output[0, :]
        else:
            raise ValueError("Unexpected model output dimensions")
        if embedding.shape != (dims,) or not np.isfinite(embedding).all():
            raise ValueError("Model returned invalid embedding")
        norm = float(np.linalg.norm(embedding))
        if norm <= 0:
            raise ValueError("Model returned zero embedding")
        scores = vectors @ (embedding.astype(np.float32) / norm)
        ranking = sorted(
            range(len(reference_ids)),
            key=lambda i: (-float(scores[i]), reference_ids[i]),
        )
        results.append({
            "expected": ref["id"],
            "top1": reference_ids[ranking[0]],
            "top5ContainsExpected": ref["id"] in [
                reference_ids[i] for i in ranking[:5]
            ],
            "selfTop1": reference_ids[ranking[0]] == ref["id"],
            "latencyMs": round(latency_ms, 2),
        })

    count = len(results)
    durations = [r["latencyMs"] for r in results]
    report = {
        "kind": "clean-reference-self-retrieval-smoke-not-camera-accuracy",
        "modelId": manifest["modelId"],
        "modelSha256": manifest["modelSha256"],
        "referenceCount": len(references),
        "languageCoverage": {
            locale: sum(ref["language"] == locale for ref in references)
            for locale in ("de", "en", "ja")
        },
        "evaluated": count,
        "selfTop1": sum(r["selfTop1"] for r in results),
        "selfTop5": sum(r["top5ContainsExpected"] for r in results),
        "coldModelSessionMs": round(startup_ms, 2),
        "cpuInferenceP50Ms": round(statistics.median(durations), 2),
        "cpuInferenceP95Ms": round(float(np.percentile(durations, 95)), 2),
        "peakProcessRssKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        "notes": "Self-retrieval on index source images: NOT physical-card accuracy or iOS latency.",
        "perReference": results,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "perReference"}, indent=2))
    if report["selfTop1"] != count or report["selfTop5"] != count:
        raise SystemExit("FAIL: the shipped ONNX model cannot retrieve its own reference cards")
    print("PASS: actual ONNX inference searches the shipped packed reference index")


if __name__ == "__main__":
    main()
