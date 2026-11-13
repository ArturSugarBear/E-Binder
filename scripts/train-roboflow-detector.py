#!/usr/bin/env python3
"""Fine-tune an Apache-2.0 RF-DETR Nano card detector on private COCO data.

This does NOT train the DINOv2 exact-card image retrieval index. It produces
object boxes and requires a separate deployment/ONNX browser benchmark.
"""
import argparse
import json
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True, help="Private COCO dataset root")
    parser.add_argument("--output", required=True, help="Private model/checkpoint output")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=4)
    args = parser.parse_args()
    if not 1 <= args.epochs <= 300:
        parser.error("epochs must be 1..300")
    if not 1 <= args.batch_size <= 32:
        parser.error("batch-size must be 1..32")
    root = Path(args.dataset).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    if output == root or root in output.parents:
        parser.error("Keep trained weights separate from private source dataset")
    if not root.is_dir():
        parser.error("The imported COCO dataset does not exist")

    images = {}
    for split in ("train", "valid", "test"):
        source = root / split / "_annotations.coco.json"
        if not source.is_file():
            parser.error(f"Missing private COCO split: {split}")
        data = json.loads(source.read_text(encoding="utf-8"))
        categories = data.get("categories")
        if categories != [{"id": 1, "name": "card", "supercategory": "trading-card"}]:
            parser.error("This trainer accepts card-box detection only, not print identities")
        images[split] = len(data.get("images", []))
        if not images[split]:
            parser.error(f"Empty {split} split; collect more photos first")
        if any(not (root / split / row["file_name"]).is_file() for row in data["images"]):
            parser.error(f"Some source files are missing in {split}")
    print(json.dumps({"datasetSplitSizes": images, "model": "RFDETRNano"}))

    # Installed separately on the training GPU: pip install "rfdetr[train]".
    # Never import heavy GPU dependencies in the frontend CI build.
    try:
        from rfdetr import RFDETRNano
    except ImportError as error:
        parser.error('Install training dependencies with pip install "rfdetr[train]"')
        raise AssertionError from error

    output.mkdir(parents=True, exist_ok=True)
    model = RFDETRNano()
    model.train(
        dataset_dir=str(root),
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=1e-4,
        output_dir=str(output),
    )
    metrics = model.evaluate(dataset_dir=str(root), split="test")
    (output / "private-test-metrics.json").write_text(
        json.dumps(metrics, indent=2, default=float) + "\n", encoding="utf-8"
    )
    model.export(format="onnx")
    print("RF-DETR Nano trained/evaluated. ONNX export requires separate Safari and geometry tests.")
    print("No images, labels or weights were added to Git or GitHub Pages.")


if __name__ == "__main__":
    main()
