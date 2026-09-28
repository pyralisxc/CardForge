export interface SpatialPoint {
  x: number;
  y: number;
}

export interface SpatialSize {
  width: number;
  height: number;
}

export interface SpatialRect extends SpatialPoint, SpatialSize {}

export interface SpatialTransform2D extends SpatialPoint {}

export interface SpatialCamera2D extends SpatialPoint {
  zoom: number;
}

export interface SpatialViewportSize extends SpatialSize {}

export interface SpatialLattice {
  origin: SpatialPoint;
  stepX: number;
  stepY: number;
  majorEvery: number;
}

export type SpatialMeasurementSpace =
  | {
      kind: 'physical';
      canonicalUnit: 'mm';
      pixelsPerMmX?: number;
      pixelsPerMmY?: number;
    }
  | {
      kind: 'digital';
      canonicalUnit: 'px';
    }
  | {
      kind: 'unresolved';
      canonicalUnit: null;
    };
