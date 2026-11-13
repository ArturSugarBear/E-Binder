# Roboflow fork → E-Binder card detector (private training)

E-Binder already has a user-owned Roboflow import described in
[dataset-audit.md](dataset-audit.md): **430 images with 1,622 source `cards`
boxes** (all API-reported, not newly downloaded in this branch); a second
**142-image** `trading-cards` project is optional. Both projects declare
**CC BY 4.0**. The image and model licenses are recorded separately from
the exact-card artwork and any pretrained model checkpoint.

## Separation of responsibilities

- **Roboflow 430-image detection project:** boxes of visible cards on photos
  and binder pages. Useful for automatic cropping and reducing failed scans.
  `cards` is an object class, not 430 uniquely identified Pokémon cards.
- **RF-DETR Nano (Apache-2.0):** trainable object detector. Train using the
  fork's boxes, evaluate on independent unseen photos, then export to ONNX.
  We deliberately do not advertise an untrained export as a shipped detector.
- **DINOv2-S:** compare the cropped image to a reference index and combine
  visual candidates with OCR/name/set/collector-number verification. The
  existing index still contains 9 German reference printings. Detector
  training does not increase that coverage by itself.

## Acquire the *existing* fork, no reupload to public Git

The authenticated API audit previously reached your workspace, but its
temporary key was removed. Set a **new** local `ROBOFLOW_API_KEY` secret and
read the project URL in your Roboflow dashboard. Never paste a token into
a GitHub issue, shell command saved in CI logs, or the browser code.

```bash
# Replace workspace/project with the actual fork shown in the Roboflow URL:
export ROBOFLOW_API_KEY='<private value>'
node scripts/roboflow-card-import.mjs \
  workspace/project /absolute/private/ebinder-card-boxes --limit=1000
unset ROBOFLOW_API_KEY
node --test tests/roboflow-card-import.test.mjs
```

The importer reads authenticated project pages and original image detail via
the official Roboflow API, downloads original photos **outside the checkout**,
normalizes the `cards`/ `trading-cards` bounding boxes to COCO and writes:

```text
private/ebinder-card-boxes/
  train/_annotations.coco.json
  valid/_annotations.coco.json
  test/_annotations.coco.json
  [train|valid|test]/<image-sha256>.(jpg|png|webp)
  private-provenance.json
```

The importer never sends a write to Roboflow, and its console summary
includes no photo URLs or API credentials. It de-duplicates byte-identical
files and hashes the original bytes to produce a deterministic **80/10/10**
split independent of Roboflow's source split (the 430-image project was
previously 100% train). It fails on unknown annotation schema, missing
dimensions, invalid images and out-of-bounds boxes instead of inventing
labels. A few images with zero card boxes are skipped. **Near duplicates,
images of the same physical card and adjacent burst captures require manual
grouping before treating the holdout as an independent accuracy benchmark**;
hash de-duplication alone is not sufficient.

## Train a candidate model (GPU machine)

```bash
pip install 'rfdetr[train]'
python scripts/train-roboflow-detector.py \
  --dataset /absolute/private/ebinder-card-boxes \
  --output /absolute/private/ebinder-rfdetr-nano \
  --epochs 30 --batch-size 4
```

The script checks COCO classes and nonempty train/valid/test splits, then
calls `RFDETRNano.train()`, `evaluate(split='test')` and
`export(format='onnx')`. It writes test metrics privately. No paid
Roboflow cloud training is needed for this local path; a GPU and local
training dependencies are required. An ONNX output is **not deployed**
automatically; its browser preprocessing, box decoding, weight hash,
performance, WebKit compatibility and false detections must be measured
before replacing existing card-geometry logic.

## Quality and use conditions

Roboflow's project label is **CC BY 4.0**; preserve attribution to the
original dataset creators, the license URL and modification notices when
distributing derived material, and keep the precise source/version in
`private-provenance.json`. This workflow keeps originals out of the
repository and does not assume that a dataset badge itself grants rights to
redistribute every Pokémon card illustration.

Current evidence does **not** establish model mAP, real iPhone latency,
per-image photo provenance, exact-card recognition, German/Japanese
printings, or a deployable RF-DETR checkpoint. Do not merge or advertise
the detector as live based only on a dataset count or a passing importer test.
