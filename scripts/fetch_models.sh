#!/usr/bin/env bash
# Downloads the pretrained models into models/ (Apache-2.0 / MIT licensed upstream).
set -euo pipefail
cd "$(dirname "$0")/../models" 2>/dev/null || { mkdir -p "$(dirname "$0")/../models"; cd "$(dirname "$0")/../models"; }

fetch() {
  local name=$1 url=$2
  if [[ -s $name ]]; then echo "ok   $name"; return; fi
  curl -sfL -o "$name" "$url" && echo "got  $name"
}

fetch u2netp.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
fetch text_detection_ppocrv3_en.onnx https://huggingface.co/opencv/text_detection_ppocr/resolve/main/text_detection_en_ppocrv3_2023may.onnx
