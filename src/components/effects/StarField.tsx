"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number; // normalized [0,1]
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  hue: number;
  sat: number;
  isBright: boolean;
}

interface Constellation {
  starIdx: number[];
  edges: [number, number][]; // local indices into starIdx
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const starsRef = useRef<Star[]>([]);
  const constellationsRef = useRef<Constellation[]>([]);
  const shootingRef = useRef<ShootingStar[]>([]);
  const startTimeRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const dimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const lastTsRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const buildField = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      dimsRef.current = { w: rect.width, h: rect.height };

      const rand = seededRandom(91827);
      const area = rect.width * rect.height;
      const count = Math.min(450, Math.max(140, Math.floor(area / 4500)));

      const stars: Star[] = [];
      for (let i = 0; i < count; i++) {
        const u = rand();
        // Power-law size: many tiny, few bright
        const size = 0.4 + Math.pow(u, 4) * 2.6;
        const isBright = size > 1.7 || rand() < 0.04;

        let hue: number;
        let sat: number;
        const colorRoll = rand();
        if (isBright && colorRoll < 0.4) {
          hue = 45; // gold
          sat = 70;
        } else if (isBright && colorRoll < 0.65) {
          hue = 270; // violet
          sat = 55;
        } else {
          hue = 220; // cool starlight white
          sat = 8;
        }

        stars.push({
          x: rand(),
          y: rand(),
          size,
          baseAlpha: 0.35 + rand() * 0.65,
          twinkleSpeed: 0.0008 + rand() * 0.0024,
          twinkleOffset: rand() * Math.PI * 2,
          hue,
          sat,
          isBright,
        });
      }
      starsRef.current = stars;

      // Build constellations: groups of nearby stars connected in a chain
      const constellations: Constellation[] = [];
      const used = new Set<number>();
      const clusterCount = 9;

      for (let c = 0; c < clusterCount; c++) {
        let seedIdx = -1;
        for (let attempt = 0; attempt < 40; attempt++) {
          const idx = Math.floor(rand() * stars.length);
          if (!used.has(idx) && stars[idx].size > 0.9) {
            seedIdx = idx;
            break;
          }
        }
        if (seedIdx < 0) break;

        const cluster = [seedIdx];
        used.add(seedIdx);
        const targetSize = 4 + Math.floor(rand() * 4); // 4..7

        for (let k = 0; k < targetSize - 1; k++) {
          const last = cluster[cluster.length - 1];
          const lastStar = stars[last];
          let bestIdx = -1;
          let bestDist = Infinity;
          for (let j = 0; j < stars.length; j++) {
            if (used.has(j)) continue;
            const dx = stars[j].x - lastStar.x;
            const dy = stars[j].y - lastStar.y;
            const d = dx * dx + dy * dy;
            if (d < bestDist && d < 0.025 && d > 0.0006) {
              bestDist = d;
              bestIdx = j;
            }
          }
          if (bestIdx < 0) break;
          cluster.push(bestIdx);
          used.add(bestIdx);
        }

        if (cluster.length < 3) continue;

        const edges: [number, number][] = [];
        for (let i = 0; i < cluster.length - 1; i++) {
          edges.push([i, i + 1]);
        }
        if (cluster.length >= 5 && rand() < 0.55) {
          const a = Math.floor(rand() * (cluster.length - 1));
          const b = Math.floor(rand() * cluster.length);
          if (
            a !== b &&
            !edges.some(
              (e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a),
            )
          ) {
            edges.push([a, b]);
          }
        }

        constellations.push({ starIdx: cluster, edges });
      }
      constellationsRef.current = constellations;
    };

    buildField();
    window.addEventListener("resize", buildField);

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const t = timestamp - startTimeRef.current;
      const delta = lastTsRef.current ? timestamp - lastTsRef.current : 16;
      lastTsRef.current = timestamp;

      const { w, h } = dimsRef.current;
      ctx.clearRect(0, 0, w, h);

      const stars = starsRef.current;
      const constellations = constellationsRef.current;

      // Constellation lines (under stars)
      ctx.lineWidth = 0.5;
      for (const con of constellations) {
        const pulse = 0.55 + 0.35 * Math.sin(t * 0.0005 + con.starIdx[0]);
        ctx.strokeStyle = `rgba(196, 181, 253, ${0.09 * pulse})`;
        for (const [a, b] of con.edges) {
          const sa = stars[con.starIdx[a]];
          const sb = stars[con.starIdx[b]];
          ctx.beginPath();
          ctx.moveTo(sa.x * w, sa.y * h);
          ctx.lineTo(sb.x * w, sb.y * h);
          ctx.stroke();
        }
      }

      // Stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const twinkle =
          0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset);
        const alpha = s.baseAlpha * (0.4 + 0.6 * twinkle);
        const x = s.x * w;
        const y = s.y * h;

        if (s.isBright) {
          const grd = ctx.createRadialGradient(x, y, 0, x, y, s.size * 5);
          grd.addColorStop(
            0,
            `hsla(${s.hue}, ${s.sat}%, 80%, ${alpha * 0.7})`,
          );
          grd.addColorStop(
            0.4,
            `hsla(${s.hue}, ${s.sat}%, 70%, ${alpha * 0.2})`,
          );
          grd.addColorStop(1, `hsla(${s.hue}, ${s.sat}%, 60%, 0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(x, y, s.size * 5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `hsla(${s.hue}, ${s.sat}%, 92%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shooting stars — spawn occasionally
      if (timestamp - lastSpawnRef.current > 7000 + Math.random() * 9000) {
        lastSpawnRef.current = timestamp;
        if (shootingRef.current.length < 2) {
          const fromLeft = Math.random() < 0.5;
          shootingRef.current.push({
            x: fromLeft ? -60 : w + 60,
            y: Math.random() * h * 0.55,
            vx: fromLeft ? 0.55 + Math.random() * 0.4 : -(0.55 + Math.random() * 0.4),
            vy: 0.22 + Math.random() * 0.3,
            life: 0,
            maxLife: 1500,
          });
        }
      }

      shootingRef.current = shootingRef.current.filter((s) => {
        s.life += delta;
        if (s.life > s.maxLife) return false;
        s.x += s.vx * delta * 0.5;
        s.y += s.vy * delta * 0.5;
        const lifeRatio = s.life / s.maxLife;
        const fade =
          lifeRatio < 0.18
            ? lifeRatio / 0.18
            : 1 - (lifeRatio - 0.18) / 0.82;
        const trailLen = 90;
        const grd = ctx.createLinearGradient(
          s.x,
          s.y,
          s.x - s.vx * trailLen,
          s.y - s.vy * trailLen,
        );
        grd.addColorStop(0, `rgba(255, 240, 200, ${0.9 * fade})`);
        grd.addColorStop(1, "rgba(255, 240, 200, 0)");
        ctx.strokeStyle = grd;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * trailLen, s.y - s.vy * trailLen);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 250, 230, ${fade})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", buildField);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

/* Static SVG zodiac wheel — concentric rings + 12 spokes + tick marks */
export function ZodiacWheel() {
  const spokes = Array.from({ length: 12 }, (_, i) => i);
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  return (
    <svg
      className="zodiac-wheel"
      viewBox="-100 -100 200 200"
      aria-hidden="true"
    >
      <circle
        cx="0"
        cy="0"
        r="98"
        fill="none"
        stroke="rgba(196, 181, 253, 0.85)"
        strokeWidth="0.25"
      />
      <circle
        cx="0"
        cy="0"
        r="78"
        fill="none"
        stroke="rgba(196, 181, 253, 0.7)"
        strokeWidth="0.2"
      />
      <circle
        cx="0"
        cy="0"
        r="58"
        fill="none"
        stroke="rgba(251, 191, 36, 0.6)"
        strokeWidth="0.2"
      />
      <circle
        cx="0"
        cy="0"
        r="34"
        fill="none"
        stroke="rgba(196, 181, 253, 0.5)"
        strokeWidth="0.15"
      />
      {spokes.map((i) => {
        const angle = (i / 12) * Math.PI * 2;
        const x1 = Math.cos(angle) * 34;
        const y1 = Math.sin(angle) * 34;
        const x2 = Math.cos(angle) * 98;
        const y2 = Math.sin(angle) * 98;
        return (
          <line
            key={`spoke-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(196, 181, 253, 0.6)"
            strokeWidth="0.15"
          />
        );
      })}
      {ticks.map((i) => {
        const angle = (i / 60) * Math.PI * 2;
        const x1 = Math.cos(angle) * 96;
        const y1 = Math.sin(angle) * 96;
        const x2 = Math.cos(angle) * 98;
        const y2 = Math.sin(angle) * 98;
        return (
          <line
            key={`tick-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(196, 181, 253, 0.9)"
            strokeWidth="0.12"
          />
        );
      })}
    </svg>
  );
}
