Face repair models, run in the visitor's browser by public/enhance-worker.js.

gfpgan-1.4.onnx.part0..3  GFPGAN v1.4 by Tencent ARC Lab (https://github.com/TencentARC/GFPGAN), Apache License 2.0.
                          ONNX conversion from the FaceFusion project's model assets
                          (https://github.com/facefusion/facefusion-assets, models-3.0.0/gfpgan_1.4.onnx).
                          Weights stored as float16 with Cast nodes back to float32, then split into four parts
                          (join them in order to get one ONNX file).
yunet-2023mar.onnx        YuNet face detector from OpenCV Zoo (https://github.com/opencv/opencv_zoo), MIT licence.
