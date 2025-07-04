import { Camera } from '@mediapipe/camera_utils';

import {
    FaceMesh,
    FaceMeshConfig,
    MatrixData,
    NormalizedLandmark,
    Options,
    Results,
} from '../face_mesh_polyfill.js';
import {
    Component,
    Object3D,
    ProjectionType,
    ViewComponent,
} from '@wonderlandengine/api';
import { property } from '@wonderlandengine/api/decorators.js';
import { mat4, quat, quat2, vec3 } from 'gl-matrix';

/**
 * Solution options.
 */
const rotationQuat = quat.create();
const translateVec = vec3.create();
const tempDirection = vec3.create();
const projectionMatrix = mat4.create();

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

    @property.object({ required: true })
    nose!: Object3D;

    @property.object({ required: true })
    glasses!: Object3D;

    @property.bool(false)
    useLandmarks = false;

    @property.float(1.0)
    depthOffset = 1.0;

    videoWidth: number;
    videoHeight: number;
    private _selectedDevice: MediaDeviceInfo;
    private _latestPoseMatrix: MatrixData | null = null;
    private _landmarkData: any;

    start() {
        this._view = this.camera.getComponent(ViewComponent);
        console.log(this.engine.canvas.clientWidth);
        const z = 1;
        this.camera.setPositionWorld([0, 0, -z]);
        if (this.useLandmarks) {
            this._view.projectionType = ProjectionType.Orthographic;
        } else {
            this._view.projectionType = ProjectionType.Perspective;
        }
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

        this._videoElement.addEventListener('loadedmetadata', () => {
            // These are the actual video dimensions
            this.videoHeight = this._videoElement.videoHeight;
            this.videoWidth = this._videoElement.videoWidth;

            console.log(
                'Video dimensions:',
                this.videoWidth,
                'x',
                this.videoHeight
            );
            console.log(
                'Element dimensions:',
                this._videoElement.clientWidth,
                'x',
                this._videoElement.clientHeight
            );

            if (this.useLandmarks) {
                this._view.extent = this.videoWidth;
            }
        });
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
            this.useLandmarks &&
            results.multiFaceLandmarks &&
            results.multiFaceLandmarks.length > 0
        ) {
            this._landmarkData = {
                eyemid: this._convertLandmark(
                    results.multiFaceLandmarks[0][168]
                ),
                eyeInnerLeft: this._convertLandmark(
                    results.multiFaceLandmarks[0][463]
                ),
                eyeInnerRight: this._convertLandmark(
                    results.multiFaceLandmarks[0][243]
                ),

                nose: this._convertLandmark(results.multiFaceLandmarks[0][1]),
            };

            return;
        }
        if (
            !this.useLandmarks &&
            results.multiFaceGeometry &&
            results.multiFaceGeometry.length > 0
        ) {
            const faceGeometry = results.multiFaceGeometry[0];
            const mesh = faceGeometry.getMesh();

            if (mesh) {
                this._latestPoseMatrix = faceGeometry.getPoseTransformMatrix();
            }
        }
    };

    update(dt: number) {
        if (!this.useLandmarks && this._latestPoseMatrix) {
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
        } else if (this.useLandmarks && this._landmarkData) {
            this.leftEye.setPositionWorld(this._landmarkData.eyeInnerLeft);
            this.rightEye.setPositionWorld(this._landmarkData.eyeInnerRight);
            this.nose.setPositionWorld(this._landmarkData.nose);
            this._landmarkData = null; // Clear after applying
        }
    }

    private _convertLandmark(
        landmark: NormalizedLandmark
    ): [number, number, number] {
        tempDirection[0] = (landmark.x - 0.5) * this.videoWidth;
        tempDirection[1] = (landmark.y - 0.5) * -this.videoHeight;
        tempDirection[2] = landmark.z * this.videoWidth * this.depthOffset;

        // Convert from MediaPipe's normalized coordinates [0,1] to NDC [-1,1]
        // tempDirection[0] = landmark.x * this.videoWidth - this.videoWidth / 2;
        // tempDirection[1] = -(
        //     landmark.y * this.videoHeight -
        //     this.videoHeight / 2
        // ); // Flip Y axis
        // tempDirection[2] = landmark.z * this.videoWidth;

        // // Get the inverse projection matrix from the view component
        // mat4.invert(projectionMatrix, this._view.projectionMatrix);

        // // Reverse-project the direction into view space
        // vec3.transformMat4(tempDirection, tempDirection, projectionMatrix);
        // vec3.normalize(tempDirection, tempDirection);

        // // Transform direction from view space to world space
        // this.camera.transformVectorWorld(tempDirection, tempDirection);

        // // Get camera position as origin
        const origin = this.camera.getPositionWorld();

        // Calculate final position along the ray at a specific depth
        const depth = this.depthOffset + landmark.z; // Use Z for depth variation
        const x = origin[0] + tempDirection[0] * depth;
        const y = origin[1] + tempDirection[1] * depth;
        const z = origin[2] - tempDirection[2] * depth;

        return [tempDirection[0], tempDirection[1], tempDirection[2]];
        //return [x, y, z];
    }
}
