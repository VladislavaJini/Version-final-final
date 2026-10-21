import React, { useState } from 'react';

interface IsoWireframe3DProps {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  thicknessMm: number;
  drawersCount: number;
  shelvesCount: number;
  totalCutsCount: number;
  compact?: boolean;
}

export const IsoWireframe3D: React.FC<IsoWireframe3DProps> = ({
  widthMm,
  heightMm,
  depthMm,
  thicknessMm,
  drawersCount,
  shelvesCount,
  totalCutsCount,
  compact = false,
}) => {
  const [viewMode, setViewMode] = useState<'iso' | 'exploded' | 'front'>('iso');

  const safeW = Math.max(200, Math.min(2400, widthMm || 600));
  const safeH = Math.max(200, Math.min(2400, heightMm || 500));
  const safeD = Math.max(150, Math.min(1200, depthMm || 400));

  // Normalize dimensions to fit cleanly inside SVG viewport (260x180)
  const maxDim = Math.max(safeW, safeH, safeD);
  const scale = 68 / maxDim;
  const w = safeW * scale;
  const h = safeH * scale;
  const d = safeD * scale;
  const explodeOffset = viewMode === 'exploded' ? 10 : 0;

  // Isometric projection helper (angle 30 deg)
  const cos30 = 0.866025;
  const sin30 = 0.5;
  const cx = 140;
  const cy = 96;

  const projectIso = (x: number, y: number, z: number) => {
    if (viewMode === 'front') {
      return {
        px: cx + (x - w / 2) * 1.15,
        py: cy + (y - h / 2) * 1.15,
      };
    }
    const sx = (x - w / 2) * cos30 - (z - d / 2) * cos30;
    const sy = (x - w / 2) * sin30 + (z - d / 2) * sin30 + (y - h / 2);
    return { px: cx + sx, py: cy + sy };
  };

  // 8 vertices of outer box
  const p000 = projectIso(0, 0, 0);
  const p100 = projectIso(w, 0, 0);
  const p110 = projectIso(w, h, 0);
  const p010 = projectIso(0, h, 0);

  const p001 = projectIso(0, 0 - explodeOffset, d);
  const p101 = projectIso(w + explodeOffset, 0, d);
  const p111 = projectIso(w + explodeOffset, h + explodeOffset, d);
  const p011 = projectIso(0 - explodeOffset, h + explodeOffset, d);

  // Inner front face (representing board thickness)
  const t = Math.max(3, Math.min(8, (thicknessMm || 18) * 0.22));
  const i001 = projectIso(t, t, d);
  const i101 = projectIso(w - t, t, d);
  const i111 = projectIso(w - t, h - t, d);
  const i011 = projectIso(t, h - t, d);

  const polyPoints = (pts: Array<{ px: number; py: number }>) =>
    pts.map((p) => `${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ');

  return (
    <div className="bg-surface-container-lowest border border-cad-slate/70 flex flex-col justify-between relative select-none">
      {!compact && (
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
          <span className="text-[11px] font-bold tracking-widest uppercase text-cad-annotation">
            VISTA PREVIA 3D
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setViewMode((prev) =>
                  prev === 'iso' ? 'exploded' : prev === 'exploded' ? 'front' : 'iso'
                )
              }
              className="bg-surface-container-high hover:bg-surface-bright text-parchment-light border border-cad-slate px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase transition-colors cursor-pointer"
              title="Alternar proyección CAD"
            >
              {viewMode === 'iso'
                ? 'ISO WIRE'
                : viewMode === 'exploded'
                ? 'DESPIECE'
                : 'FRENTE 2D'}
            </button>
          </div>
        </div>
      )}

      <div className="w-full flex items-center justify-center py-1">
        <svg
          viewBox="0 0 280 185"
          className={compact ? 'w-full h-32' : 'w-full h-44 max-w-[320px]'}
          aria-label="Proyección CAD Isométrica"
        >
          {/* Back hidden edges (dashed slate) */}
          <line
            x1={p000.px}
            y1={p000.py}
            x2={p100.px}
            y2={p100.py}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <line
            x1={p000.px}
            y1={p000.py}
            x2={p010.px}
            y2={p010.py}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <line
            x1={p000.px}
            y1={p000.py}
            x2={p001.px}
            y2={p001.py}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Outer back/side edges */}
          <polygon
            points={polyPoints([p000, p100, p101, p001])}
            fill="rgba(232, 122, 80, 0.04)"
            stroke="#94A3B8"
            strokeWidth="1.1"
          />
          <polygon
            points={polyPoints([p100, p110, p111, p101])}
            fill="rgba(232, 122, 80, 0.06)"
            stroke="#94A3B8"
            strokeWidth="1.1"
          />
          <polygon
            points={polyPoints([p000, p010, p011, p001])}
            fill="none"
            stroke="#64748B"
            strokeWidth="1"
          />

          {/* Front Primary Terracotta Face */}
          <polygon
            points={polyPoints([p001, p101, p111, p011])}
            fill="rgba(232, 122, 80, 0.05)"
            stroke="#E87A50"
            strokeWidth="1.6"
          />

          {/* Inner Carcass Thickness Wireframe */}
          <polygon
            points={polyPoints([i001, i101, i111, i011])}
            fill="none"
            stroke="#E87A50"
            strokeWidth="0.9"
            strokeOpacity="0.75"
          />

          {/* Internal Shelves */}
          {Array.from({ length: Math.min(5, Math.max(0, shelvesCount)) }).map((_, idx) => {
            const ratio = (idx + 1) / (shelvesCount + 1);
            const sy = h * ratio;
            const sLeft = projectIso(t, sy, d);
            const sRight = projectIso(w - t, sy, d);
            const sBackRight = projectIso(w - t, sy, t);
            return (
              <g key={`shelf-${idx}`}>
                <line
                  x1={sLeft.px}
                  y1={sLeft.py}
                  x2={sRight.px}
                  y2={sRight.py}
                  stroke="#FFB59B"
                  strokeWidth="1.1"
                />
                <line
                  x1={sRight.px}
                  y1={sRight.py}
                  x2={sBackRight.px}
                  y2={sBackRight.py}
                  stroke="#64748B"
                  strokeWidth="0.8"
                  strokeDasharray="2 2"
                />
              </g>
            );
          })}

          {/* Drawers visualization */}
          {Array.from({ length: Math.min(4, Math.max(0, drawersCount)) }).map((_, idx) => {
            const totalD = Math.min(4, drawersCount);
            const bandH = (h - t * 2) / totalD;
            const yTop = t + idx * bandH + 1.5;
            const yBot = t + (idx + 1) * bandH - 1.5;
            const zOut = viewMode === 'exploded' ? d + 12 : d + 2;
            const d0 = projectIso(t + 1.5, yTop, zOut);
            const d1 = projectIso(w - t - 1.5, yTop, zOut);
            const d2 = projectIso(w - t - 1.5, yBot, zOut);
            const d3 = projectIso(t + 1.5, yBot, zOut);
            return (
              <polygon
                key={`drawer-${idx}`}
                points={polyPoints([d0, d1, d2, d3])}
                fill="rgba(255, 181, 155, 0.08)"
                stroke="#FFB59B"
                strokeWidth="1"
              />
            );
          })}

          {/* Thickness dimension annotation callout (top-left like Image 9) */}
          <line
            x1={p001.px - 18}
            y1={p001.py - 4}
            x2={p001.px - 2}
            y2={p001.py - 4}
            stroke="#94A3B8"
            strokeWidth="0.9"
          />
          <line
            x1={i001.px - 18}
            y1={i001.py}
            x2={i001.px - 2}
            y2={i001.py}
            stroke="#94A3B8"
            strokeWidth="0.9"
          />
          <text
            x={p001.px - 24}
            y={p001.py - 8}
            fill="#FAF7F2"
            fontSize="8"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="700"
          >
            e: {thicknessMm || 18}mm
          </text>

          {/* Dimensions Readout */}
          <text
            x="16"
            y="172"
            fill="#64748B"
            fontSize="8.5"
            fontFamily="JetBrains Mono, monospace"
          >
            {safeW}×{safeH}×{safeD}mm
          </text>

          {/* Mini CAD Axis gizmo bottom-right */}
          <g transform="translate(226, 148)">
            <line x1="0" y1="0" x2="0" y2="-14" stroke="#64748B" strokeWidth="1" />
            <line x1="0" y1="0" x2="12" y2="7" stroke="#64748B" strokeWidth="1" />
            <line x1="0" y1="0" x2="-12" y2="7" stroke="#64748B" strokeWidth="1" />
            <circle cx="0" cy="0" r="1.5" fill="#E87A50" />
          </g>
        </svg>
      </div>

      {!compact && (
        <div className="pb-2.5 flex items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[15px]">
            check_circle
          </span>
          <span className="text-[11px] font-bold tracking-widest uppercase text-parchment-light">
            {totalCutsCount} CORTES
          </span>
        </div>
      )}
    </div>
  );
};
