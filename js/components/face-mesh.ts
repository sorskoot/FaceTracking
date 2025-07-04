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
const rotationQuat = quat.create();
const translateVec = vec3.create();

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

    @property.bool(false)
    useLandmarks = false;

    videoWidth: number;
    videoHeight: number;
    private _selectedDevice: MediaDeviceInfo;
    private _latestPoseMatrix: MatrixData | null = null;

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
        const z = 1;
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

    private _getSolutionOptions(): Options {
        return {
            selfieMode: true,
            enableFaceGeometry: this.useLandmarks ? false : true,
            maxNumFaces: 1,
            refineLandmarks: this.useLandmarks ? true : false,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6,
        };
    }

    private _startFaceMesh() {
        this._videoElement = document.getElementById(
            'webcam-video'
        ) as HTMLVideoElement;

        this.videoHeight = this._videoElement.clientHeight;
        this.videoWidth = this._videoElement.clientWidth;

        const faceMeshConfig: FaceMeshConfig = {
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            },
        };
        const faceMesh = new FaceMesh(faceMeshConfig);
        faceMesh.setOptions(this._getSolutionOptions());
        faceMesh.onResults(this.onResults);

        const camera = new Camera(this._videoElement, {
            onFrame: async () => {
                await faceMesh.send({ image: this._videoElement });
            },
            width: this.engine.canvas.clientWidth,
            height: this.engine.canvas.clientHeight,
        });
        camera.start();

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

    onResults = (results: Results): void => {
        if (
            results.multiFaceLandmarks ||
            results.multiFaceLandmarks.length > 0
        ) {
            return;
        }
        if (results.multiFaceGeometry && results.multiFaceGeometry.length > 0) {
            const faceGeometry = results.multiFaceGeometry[0];
            const mesh = faceGeometry.getMesh();

            if (mesh) {
                this._latestPoseMatrix = faceGeometry.getPoseTransformMatrix();
            }
        }
    };

    update(dt: number) {
        if (this._latestPoseMatrix) {
            const mat = mat4.fromValues(
                this._latestPoseMatrix.getPackedDataList()[0],
                this._latestPoseMatrix.getPackedDataList()[1],
                this._latestPoseMatrix.getPackedDataList()[2],
                this._latestPoseMatrix.getPackedDataList()[3],
                this._latestPoseMatrix.getPackedDataList()[4],
                this._latestPoseMatrix.getPackedDataList()[5],
                this._latestPoseMatrix.getPackedDataList()[6],
                this._latestPoseMatrix.getPackedDataList()[7],
                this._latestPoseMatrix.getPackedDataList()[8],
                this._latestPoseMatrix.getPackedDataList()[9],
                this._latestPoseMatrix.getPackedDataList()[10],
                this._latestPoseMatrix.getPackedDataList()[11],
                this._latestPoseMatrix.getPackedDataList()[12],
                this._latestPoseMatrix.getPackedDataList()[13],
                this._latestPoseMatrix.getPackedDataList()[14],
                this._latestPoseMatrix.getPackedDataList()[15]
            );

            mat4.getRotation(rotationQuat, mat);
            mat4.getTranslation(translateVec, mat);

            const scaleFactor = 1;
            vec3.scale(translateVec, translateVec, scaleFactor);

            this.object.setRotationWorld(rotationQuat);
            this.object.setPositionWorld(translateVec);

            this._latestPoseMatrix = null; // Clear after applying
        }
    }
}
