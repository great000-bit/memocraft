realesr-general-x4v3.onnx

Real-ESRGAN "realesr-general-x4v3" (4x photo upscaler), converted from the official weights
(https://github.com/xinntao/Real-ESRGAN/releases/tag/v0.2.5.0) to ONNX, float32, dynamic input size.
Real-ESRGAN is BSD 3-Clause licensed; see LICENSE-Real-ESRGAN.txt.
Layers: 33 3x3 convolutions with PReLU, a 4x pixel shuffle, plus a nearest-neighbour 4x copy of the input added on top.
It runs in the visitor's browser (see public/enhance-worker.js); the file is served from this site.
