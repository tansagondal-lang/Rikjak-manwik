import React, { useMemo } from 'react';
import { getCompiledTrack } from '../data/tracks';
import { MinimapDot, TrackId } from '../types/game';

interface MinimapProps {
  trackId: TrackId;
  dots?: MinimapDot[];
  highContrast?: boolean;
}

const SVG_SIZE = 128;
const PADDING = 14;

export const Minimap: React.FC<MinimapProps> = ({ trackId, dots, highContrast }) => {
  const layout = useMemo(() => {
    const compiled = getCompiledTrack(trackId);
    const samples = compiled.samples;
    // Downsample to 36 crisp low-poly vertices for minimal SVG DOM & zero lag on 512MB phones
    const step = Math.max(1, Math.floor(samples.length / 36));
    const polyPts: Array<{ x: number; z: number }> = [];

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < samples.length; i += step) {
      const p = samples[i].point;
      polyPts.push({ x: p.x, z: p.z });
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const usable = SVG_SIZE - PADDING * 2;
    const scale = Math.min(usable / spanX, usable / spanZ);
    const offsetX = PADDING + (usable - spanX * scale) / 2;
    const offsetY = PADDING + (usable - spanZ * scale) / 2;

    const toMap = (wx: number, wz: number) => ({
      mx: offsetX + (wx - minX) * scale,
      my: offsetY + (wz - minZ) * scale,
    });

    const pointsAttr = polyPts
      .map((pt) => {
        const { mx, my } = toMap(pt.x, pt.z);
        return `${mx.toFixed(1)},${my.toFixed(1)}`;
      })
      .join(' ');

    const start = samples[0];
    const startPos = toMap(start.point.x, start.point.z);
    const startPerp = {
      x1: startPos.mx - start.right.x * 6,
      y1: startPos.my - start.right.z * 6,
      x2: startPos.mx + start.right.x * 6,
      y2: startPos.my + start.right.z * 6,
    };

    return { pointsAttr, startPerp, minX, minZ, scale, offsetX, offsetY };
  }, [trackId]);

  const mapPoint = (wx: number, wz: number) => ({
    mx: layout.offsetX + (wx - layout.minX) * layout.scale,
    my: layout.offsetY + (wz - layout.minZ) * layout.scale,
  });

  return (
    <div
      className={`rounded-xl border p-1.5 shadow-lg ${
        highContrast
          ? 'bg-black border-white'
          : 'bg-slate-950/85 border-white/15'
      }`}
      aria-label="Track Mini-Map"
    >
      <svg
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="w-24 h-24 sm:w-32 sm:h-32 block"
      >
        {/* Outer Low-Poly Track Curb */}
        <polygon
          points={layout.pointsAttr}
          fill="none"
          stroke="rgba(148, 163, 184, 0.35)"
          strokeWidth={8}
          strokeLinejoin="miter"
        />
        {/* Inner Asphalt Track Ribbon */}
        <polygon
          points={layout.pointsAttr}
          fill="none"
          stroke="#475569"
          strokeWidth={4.5}
          strokeLinejoin="miter"
        />
        {/* Start / Finish Line Marker */}
        <line
          x1={layout.startPerp.x1}
          y1={layout.startPerp.y1}
          x2={layout.startPerp.x2}
          y2={layout.startPerp.y2}
          stroke="#f8fafc"
          strokeWidth={2.5}
        />

        {/* Opponent / P2 Dots */}
        {dots
          ?.filter((d) => !d.isP1)
          .map((d) => {
            const { mx, my } = mapPoint(d.x, d.z);
            return (
              <circle
                key={d.id}
                cx={mx}
                cy={my}
                r={d.isP2 ? 4 : 3.2}
                fill={d.isP2 ? '#22d3ee' : '#f43f5e'}
                stroke="#020617"
                strokeWidth={1.2}
              />
            );
          })}

        {/* Player 1 Directional Low-Poly Triangle */}
        {dots
          ?.filter((d) => d.isP1)
          .map((d) => {
            const { mx, my } = mapPoint(d.x, d.z);
            // Model forward is -Z at yaw=0, +yaw rotates CCW in XZ (x=-sin(yaw), z=-cos(yaw))
            const deg = (-d.yaw * 180) / Math.PI;
            return (
              <g key={d.id} transform={`translate(${mx.toFixed(1)}, ${my.toFixed(1)}) rotate(${deg.toFixed(1)})`}>
                <polygon
                  points="0,-6 4.5,4.5 0,2 -4.5,4.5"
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth={1.2}
                />
              </g>
            );
          })}
      </svg>
    </div>
  );
};
