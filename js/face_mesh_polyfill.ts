// Polyfill navigator if undefined
if (typeof navigator === 'undefined') {
    (globalThis as any).navigator = {
        platform: 'Win32',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    };
}

// Re-export everything from the original package
export * from '@mediapipe/face_mesh';
