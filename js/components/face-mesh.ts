import { Camera } from '@mediapipe/camera_utils';

import {
    FaceMesh,
    FaceMeshConfig,
    MatrixData,
    Options,
    Results,
} from '../face_mesh_polyfill.js';
import { Component, Object3D, ViewComponent } from '@wonderlandengine/api';
import { property } from '@wonderlandengine/api/decorators.js';
import { mat4, quat, quat2, vec3 } from 'gl-matrix';

/**
 * Solution options.
 */
const solutionOptions: Options = {
    selfieMode: true,
    enableFaceGeometry: true,
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
    cameraVerticalFovDegrees: 45,
};

export class FaceMeshComponent extends Component {
    static TypeName = 'face-mesh';
    private _videoElement: HTMLVideoElement;

    @property.object({ required: true })
    camera!: Object3D;
    private _view: ViewComponent;

    @property.object({ required: true })
    leftEye!: Object3D;

    @property.object({ required: true })
    rightEye!: Object3D;

    videoWidth: number;
    videoHeight: number;
    private _selectedDevice: MediaDeviceInfo;

    init() {}

    // we need to resize canvas rendering dimensions
    // when canvas sytling dimensions change
    resizeRendererToDisplaySize() {
        const canvas = this.engine.canvas;

        // match dimension of canvas with
        // dimension of video
        if (
            this.videoWidth != canvas.clientWidth ||
            this.videoHeight != canvas.clientHeight
        ) {
            const width = this.videoWidth;
            const height = this.videoHeight;
            // canvas.style.width = `${width}px`;
            // canvas.style.height = `${height}px`;
        }

        // canvas has 2 width
        // 1) style width set with style attribute
        // 2) rendering width set with width and height attribute
        // update rendering width to match styling width.
        const width = canvas.clientWidth | 0;
        const height = canvas.clientHeight | 0;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
            this.engine.resize(width, height);
        }
        return needResize;
    }

    start() {
        this._view = this.camera.getComponent(ViewComponent);
        console.log(this.engine.canvas.clientWidth);
        //      this._view.extent = this.videoWidth;
        const z = 1;
        // this.engine.canvas.height /
        // 10 /
        // 2 /
        // Math.tan(((this._view.fov / 2) * Math.PI) / 180);
        this.camera.setPositionWorld([0, 0, -z]);

        const str = 'Elgato Facecam (0fd9:0078)';

        if (!WL_EDITOR) {
            navigator.mediaDevices.enumerateDevices().then((devices) => {
                devices.forEach((device) => {
                    if (device.kind === 'videoinput' && device.label === str) {
                        this._selectedDevice = device;
                    }
                });
                this._startFaceMesh();
            });
        }
    }

    private _startFaceMesh() {
        this._videoElement = document.getElementById(
            'webcam-video'
        ) as HTMLVideoElement;

        this.videoHeight = this._videoElement.clientHeight;
        this.videoWidth = this._videoElement.clientWidth;
        //        this.resizeRendererToDisplaySize();

        const faceMeshConfig: FaceMeshConfig = {
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            },
        };
        const faceMesh = new FaceMesh(faceMeshConfig);
        faceMesh.setOptions(solutionOptions);
        faceMesh.onResults(this.onResults);

        const camera = new Camera(this._videoElement, {
            onFrame: async () => {
                await faceMesh.send({ image: this._videoElement });
            },
            width: this.engine.canvas.clientWidth, //1280,
            height: this.engine.canvas.clientHeight, //720,
        });
        camera.start();
        //set src to this._selectedDevice
        if (this._selectedDevice) {
            navigator.mediaDevices
                .getUserMedia({
                    video: { deviceId: this._selectedDevice.deviceId },
                })
                .then((e) => {
                    this._videoElement.srcObject = e;
                });
        } else {
            console.warn('No video input device selected');
        }
    }

    update(dt: number) {}

    onResults = (results: Results): void => {
        if (results.multiFaceGeometry && results.multiFaceGeometry.length > 0) {
            const faceGeometry = results.multiFaceGeometry[0];
            // const lm = transformLandmarks(results.multiFaceLandmarks[0]);

            // lm.forEach((landmark, index) => {});
            const mesh = faceGeometry.getMesh();
            // const leftEyeInner = results.multiFaceLandmarks[0][463];
            // const rightEyeInner = results.multiFaceLandmarks[0][243];
            // const width = this.engine.canvas.width;
            // const height = this.engine.canvas.height;

            // let midEyes = scaleLandmark(lm[168], width, height);
            // this.leftEye.setPositionWorld([midEyes[0], midEyes[1], midEyes[2]]);
            // console.log(
            //     `Left eye inner: ${leftEyeInner.x * width}, ${
            //         leftEyeInner.y * height
            //     }, ${leftEyeInner.z * width * 100}`
            // );

            // this.leftEye.setPositionWorld([
            //     leftEyeInner.x * width,
            //     leftEyeInner.y * height,
            //     leftEyeInner.z * width * 100,
            // ]);
            // this.rightEye.setPositionWorld([
            //     rightEyeInner.x * width,
            //     rightEyeInner.y * height,
            //     rightEyeInner.z * width * 100,
            // ]);
            if (mesh) {
                const poseMatrix: MatrixData =
                    faceGeometry.getPoseTransformMatrix();

                const mat = mat4.fromValues(
                    poseMatrix.getPackedDataList()[0],
                    poseMatrix.getPackedDataList()[1],
                    poseMatrix.getPackedDataList()[2],
                    poseMatrix.getPackedDataList()[3],
                    poseMatrix.getPackedDataList()[4],
                    poseMatrix.getPackedDataList()[5],
                    poseMatrix.getPackedDataList()[6],
                    poseMatrix.getPackedDataList()[7],
                    poseMatrix.getPackedDataList()[8],
                    poseMatrix.getPackedDataList()[9],
                    poseMatrix.getPackedDataList()[10],
                    poseMatrix.getPackedDataList()[11],
                    poseMatrix.getPackedDataList()[12],
                    poseMatrix.getPackedDataList()[13],
                    poseMatrix.getPackedDataList()[14],
                    poseMatrix.getPackedDataList()[15]
                );

                // Adjust coordinate system from Mediapipe to Wonderland Engine
                // const adjustMat = mat4.create();
                // mat4.fromScaling(adjustMat, [1, 1, 1]);
                // mat4.multiply(mat, adjustMat, mat);

                // Extract rotation and translation
                const rotationQuat = quat.create();
                const translate = vec3.create();
                mat4.getRotation(rotationQuat, mat);
                mat4.getTranslation(translate, mat);

                // Optional: Apply a scaling factor if translation seems off
                const scaleFactor = 1; // Adjust this if needed
                vec3.scale(translate, translate, scaleFactor);

                // Apply rotation and translation to your object
                this.object.setRotationWorld(rotationQuat);
                this.object.setPositionWorld(translate);
            }
        }
    };
}

const transformLandmarks = (landmarks) => {
    if (!landmarks) {
        return landmarks;
    }

    let hasVisiblity = !!landmarks.find((l) => l.visibility);

    let minZ = 1e-4;

    // currently mediapipe facemesh js
    // has visibility set to undefined
    // so we use a heuristic to set z position of facemesh
    if (hasVisiblity) {
        landmarks.forEach((landmark) => {
            let { z, visibility } = landmark;
            z = -z;
            if (z < minZ && visibility) {
                minZ = z;
            }
        });
    } else {
        minZ = Math.max(-landmarks[234].z, -landmarks[454].z);
    }

    return landmarks.map((landmark) => {
        let { x, y, z } = landmark;
        return {
            x: -0.5 + x,
            y: 0.5 - y,
            z: -z - minZ,
            visibility: landmark.visibility,
        };
    });
};

const scaleLandmark = (landmark, width, height): [number, number, number] => {
    let { x, y, z } = landmark;
    return [x * width, y * height, z * width];
};
