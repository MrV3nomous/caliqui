export type InteractionMode = 'idle' | 'drag' | 'resize' | 'rotate' | 'crop';

export type DragState = {
  startMouseAngle: number;
  startRotationOffset: number;
  startMouseX: number;
  startMouseY: number;
  startScaleX: number;
  startScaleY: number;
  startDistance: number;
};

export interface PointerCapturable {
  setPointerCapture?: (id: number) => void;
  releasePointerCapture?: (id: number) => void;
}

export const ROTATE_CURSOR = `url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIxLjUgMnY2aC02TTIxLjM0IDE1LjU3YTEwIDEwIDAgMSAxLS41OS04LjM2bDUuNjctNS42NyIvPjwvc3ZnPg==') 12 12, auto`;

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 5.0;
