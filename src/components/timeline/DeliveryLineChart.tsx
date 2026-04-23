'use client';

import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { DeliveryPoint } from '@/lib/narrative-utils';
import type { ChartStyle } from './ForceLineChart';

const DELIVERY_COLOR = '#F59E0B';
const PEAK_COLOR = '#FCD34D';
const VALLEY_COLOR = '#93C5FD';

const CURVE_FNS = {
  smooth: d3.curveMonotoneX,
  linear: d3.curveLinear,
  step: d3.curveStepAfter,
};

type DeliveryLineChartProps = {
  delivery: DeliveryPoint[];
  currentIndex: number;
  windowStart?: number;
  windowEnd?: number;
  raw?: boolean;
  style?: ChartStyle;
  average?: number;
};

export default function DeliveryLineChart({
  delivery,
  currentIndex,
  windowStart,
  windowEnd,
  raw,
  style,
  average,
}: DeliveryLineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 200, height: 60 });

  const showArea = style?.showArea ?? true;
  const showWindow = style?.showWindow ?? true;
  const curveFn = CURVE_FNS[style?.curve ?? 'smooth'];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDims({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (delivery.length === 0) return;

    const { width, height } = dims;

    const xScale = d3.scaleLinear()
      .domain([0, Math.max(delivery.length - 1, 1)])
      .range([0, width]);

    // Percentile-clipped domain so the chart isn't visually dominated by a
    // handful of extreme scenes. Values outside the clipped range are clamped
    // to the chart edge and marked with overflow ticks.
    const allValues = delivery.flatMap((e) => [e.smoothed, e.macroTrend]);
    const absSorted = allValues.map(Math.abs).sort((a, b) => a - b);
    const pIdx = Math.max(0, Math.floor(absSorted.length * 0.95) - 1);
    const clipAbs = Math.max(absSorted[pIdx] ?? 0.5, 0.5);
    const trueAbs = absSorted.at(-1) ?? clipAbs;
    const hasOverflow = trueAbs > clipAbs * 1.05;
    const yScale = d3.scaleLinear()
      .domain([-clipAbs * 1.15, clipAbs * 1.15])
      .range([height, 0])
      .clamp(true);

    const zeroY = yScale(0);

    // Zero line
    svg.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', zeroY).attr('y2', zeroY)
      .attr('stroke', '#FFFFFF').attr('stroke-width', 0.5).attr('opacity', 0.12);

    // Window highlight
    if (showWindow && windowStart != null && windowEnd != null && delivery.length > 1) {
      const wx1 = xScale(windowStart);
      const wx2 = xScale(windowEnd);
      svg.append('rect')
        .attr('x', wx1).attr('y', 0)
        .attr('width', Math.max(wx2 - wx1, 1)).attr('height', height)
        .attr('fill', DELIVERY_COLOR).attr('opacity', 0.06);
      svg.append('line')
        .attr('x1', wx1).attr('x2', wx1)
        .attr('y1', 0).attr('y2', height)
        .attr('stroke', DELIVERY_COLOR).attr('stroke-width', 0.5).attr('opacity', 0.3);
    }

    // Positive area fill (above zero)
    if (showArea) {
      svg.append('path')
        .datum(delivery)
        .attr('d', d3.area<DeliveryPoint>()
          .x((e) => xScale(e.index))
          .y0(zeroY)
          .y1((e) => yScale(Math.max(0, e.smoothed)))
          .curve(curveFn))
        .attr('fill', DELIVERY_COLOR).attr('opacity', 0.10);

      // Negative area fill (below zero)
      svg.append('path')
        .datum(delivery)
        .attr('d', d3.area<DeliveryPoint>()
          .x((e) => xScale(e.index))
          .y0(zeroY)
          .y1((e) => yScale(Math.min(0, e.smoothed)))
          .curve(curveFn))
        .attr('fill', VALLEY_COLOR).attr('opacity', 0.07);
    }

    // Macro trend (dashed white)
    svg.append('path')
      .datum(delivery)
      .attr('d', d3.line<DeliveryPoint>()
        .x((e) => xScale(e.index))
        .y((e) => yScale(e.macroTrend))
        .curve(d3.curveMonotoneX))
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    // Primary smoothed delivery line
    svg.append('path')
      .datum(delivery)
      .attr('d', d3.line<DeliveryPoint>()
        .x((e) => xScale(e.index))
        .y((e) => yScale(e.smoothed))
        .curve(curveFn))
      .attr('fill', 'none')
      .attr('stroke', DELIVERY_COLOR)
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.9);

    // Peak markers — small dots
    for (const e of delivery) {
      if (!e.isPeak) continue;
      const cx = xScale(e.index);
      const cy = yScale(e.smoothed);
      svg.append('circle')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 2)
        .attr('fill', PEAK_COLOR)
        .attr('opacity', 0.9);
    }

    // Valley markers — small dots
    for (const e of delivery) {
      if (!e.isValley) continue;
      const cx = xScale(e.index);
      const cy = yScale(e.smoothed);
      svg.append('circle')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 2)
        .attr('fill', VALLEY_COLOR)
        .attr('opacity', 0.8);
    }

    // Overflow markers for smoothed values outside the clipped domain.
    if (hasOverflow) {
      const overflowHi = clipAbs * 1.15;
      const overflowLo = -clipAbs * 1.15;
      for (const e of delivery) {
        const x = xScale(e.index);
        if (e.smoothed > overflowHi) {
          svg.append('path')
            .attr('d', `M ${x - 2.5} 3 L ${x + 2.5} 3 L ${x} 0 Z`)
            .attr('fill', DELIVERY_COLOR)
            .attr('opacity', 0.7);
        } else if (e.smoothed < overflowLo) {
          svg.append('path')
            .attr('d', `M ${x - 2.5} ${height - 3} L ${x + 2.5} ${height - 3} L ${x} ${height} Z`)
            .attr('fill', VALLEY_COLOR)
            .attr('opacity', 0.7);
        }
      }
    }

    // Current scene cursor
    if (currentIndex >= 0 && currentIndex < delivery.length) {
      const e = delivery[currentIndex];
      const cx = xScale(e.index);
      const cy = yScale(e.smoothed);

      svg.append('line')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', 0).attr('y2', height)
        .attr('stroke', 'rgba(255,255,255,0.15)')
        .attr('stroke-width', 1);

      svg.append('circle')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 3)
        .attr('fill', DELIVERY_COLOR)
        .attr('stroke', '#111')
        .attr('stroke-width', 1.5);
    }
  }, [delivery, currentIndex, dims, windowStart, windowEnd, showArea, showWindow, curveFn]);

  const currentValue = currentIndex >= 0 && currentIndex < delivery.length
    ? delivery[currentIndex]
    : undefined;

  return (
    <div className="flex-1 flex flex-col px-2 py-1.5 min-w-0 overflow-hidden">
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="flex items-baseline gap-1">
          <span className="text-[9px] uppercase tracking-wider text-text-dim">Delivery</span>
          {raw && <span className="text-[8px] text-text-dim opacity-50">raw</span>}
        </span>
        <span className="flex items-center gap-1.5">
          {average !== undefined && (
            <span className="text-[9px] font-mono font-medium" style={{ color: DELIVERY_COLOR, opacity: 0.5 }}>
              ({average.toFixed(2)})
            </span>
          )}
          {currentValue && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: DELIVERY_COLOR, boxShadow: `0 0 4px ${DELIVERY_COLOR}` }}
              />
              <span className="text-[9px] font-mono font-semibold" style={{ color: DELIVERY_COLOR }}>
                {currentValue.smoothed.toFixed(2)}
              </span>
            </span>
          )}
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0">
        <svg ref={svgRef} width={dims.width} height={dims.height} className="block" preserveAspectRatio="none" />
      </div>
    </div>
  );
}
