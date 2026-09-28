import { describe, expect, it } from 'vitest';

import {
  composeSpatialTranslation,
  fitSpatialCameraToRect,
  getSpatialEdgePanScreenVelocity,
  getSpatialLocalTranslation,
  getSpatialRectUnion,
  projectSpatialScreenToWorld,
  projectSpatialScreenVelocityToWorld,
  projectSpatialWorldToScreen,
  snapSpatialPoint,
} from '@/domain/spatial';

describe('creator spatial foundation', () => {
  it('frames signed authored bounds without changing them', () => {
    const bounds = { x: -240, y: 80, width: 480, height: 240 };
    const before = { ...bounds };
    expect(fitSpatialCameraToRect({
      bounds,
      viewport: { width: 1200, height: 720 },
      padding: 60,
    })).toEqual({ x: 0, y: 200, zoom: 2.5 });
    expect(bounds).toEqual(before);
  });

  it('round-trips signed world coordinates through an orthographic camera', () => {
    const camera = { x: -320, y: 180, zoom: 1.75 };
    const viewport = { width: 1280, height: 720 };
    const worldPoint = { x: -940, y: 512 };

    const screenPoint = projectSpatialWorldToScreen(worldPoint, camera, viewport);
    const restored = projectSpatialScreenToWorld(screenPoint, camera, viewport);

    expect(restored.x).toBeCloseTo(worldPoint.x, 8);
    expect(restored.y).toBeCloseTo(worldPoint.y, 8);
  });

  it('keeps child-local transforms stable when a parent translates', () => {
    const local = { x: -42, y: 85 };
    const firstParent = { x: 200, y: -100 };
    const secondParent = { x: -750, y: 440 };

    const firstWorld = composeSpatialTranslation(firstParent, local);
    const secondWorld = composeSpatialTranslation(secondParent, local);

    expect(firstWorld).toEqual({ x: 158, y: -15 });
    expect(secondWorld).toEqual({ x: -792, y: 525 });
    expect(getSpatialLocalTranslation(secondParent, secondWorld)).toEqual(local);
  });

  it('derives bounds across negative and positive authored space without rebasing nodes', () => {
    const rects = [
      { x: -180, y: -40, width: 63, height: 88 },
      { x: 250, y: 120, width: 215.9, height: 279.4 },
    ];
    const before = structuredClone(rects);

    expect(getSpatialRectUnion(rects)).toEqual({
      x: -180,
      y: -40,
      width: 645.9,
      height: 439.4,
    });
    expect(rects).toEqual(before);
  });

  it('snaps signed points against a coordinate-space lattice origin', () => {
    expect(snapSpatialPoint(
      { x: -13.1, y: 31.1 },
      { origin: { x: 2, y: -4 }, stepX: 5, stepY: 10, majorEvery: 5 },
    )).toEqual({ x: -13, y: 36 });
  });

  it('produces gentle edge-pan velocity only inside the screen-space edge zone', () => {
    const viewport = { width: 1000, height: 700 };

    expect(getSpatialEdgePanScreenVelocity({
      pointer: { x: 500, y: 350 },
      viewport,
      edgeZone: 100,
      maxScreenSpeed: 800,
    })).toEqual({ x: 0, y: 0 });

    const nearRight = getSpatialEdgePanScreenVelocity({
      pointer: { x: 950, y: 350 },
      viewport,
      edgeZone: 100,
      maxScreenSpeed: 800,
    });
    const atRight = getSpatialEdgePanScreenVelocity({
      pointer: { x: 1000, y: 350 },
      viewport,
      edgeZone: 100,
      maxScreenSpeed: 800,
    });

    expect(nearRight.x).toBe(200);
    expect(atRight.x).toBe(800);
    expect(projectSpatialScreenVelocityToWorld(atRight, 2)).toEqual({ x: 400, y: 0 });
  });
});
