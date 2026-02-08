'use client';

import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

type ForceLineChartProps = {
  data: number[];
  color: string;
  label: string;
  currentIndex: number;
  /** Inclusive data-index range for the active normalization window */
  windowStart?: number;
  windowEnd?: number;
};

export default function ForceLineChart({
  data,
  color,
  label,
  currentIndex,
  windowStart,
  windowEnd,
}: ForceLineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 200, height: 60 });

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDims({ width, height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // D3 rendering
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (data.length === 0) return;

    const { width, height } = dims;
    const chartTop = 0;
    const chartHeight = height;

    const xScale = d3
      .scaleLinear()
      .domain([0, Math.max(data.length - 1, 1)])
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([-1, 1])
      .range([chartHeight, chartTop]);

    // Zero line at y=0
    const zeroY = yScale(0);
    svg
      .append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', zeroY)
      .attr('y2', zeroY)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.12);

    // Window highlight region
    if (windowStart != null && windowEnd != null && data.length > 1) {
      const wx1 = xScale(windowStart);
      const wx2 = xScale(windowEnd);
      svg
        .append('rect')
        .attr('x', wx1)
        .attr('y', chartTop)
        .attr('width', Math.max(wx2 - wx1, 1))
        .attr('height', chartHeight)
        .attr('fill', color)
        .attr('opacity', 0.06);
      // Left edge
      svg
        .append('line')
        .attr('x1', wx1)
        .attr('x2', wx1)
        .attr('y1', chartTop)
        .attr('y2', chartHeight)
        .attr('stroke', color)
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.3);
    }

    // Area (filled from zero line)
    const area = d3
      .area<number>()
      .x((_, i) => xScale(i))
      .y0(zeroY)
      .y1((d) => yScale(d))
      .curve(d3.curveMonotoneX);

    svg
      .append('path')
      .datum(data)
      .attr('d', area)
      .attr('fill', color)
      .attr('opacity', 0.1);

    // Line
    const line = d3
      .line<number>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d))
      .curve(d3.curveMonotoneX);

    svg
      .append('path')
      .datum(data)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.8);

    // Current scene cursor
    if (currentIndex >= 0 && currentIndex < data.length) {
      const cx = xScale(currentIndex);
      svg
        .append('line')
        .attr('x1', cx)
        .attr('x2', cx)
        .attr('y1', chartTop)
        .attr('y2', chartHeight)
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 1)
        .attr('opacity', 0.2);
    }
  }, [data, color, currentIndex, dims, windowStart, windowEnd]);

  const currentValue =
    currentIndex >= 0 && currentIndex < data.length
      ? data[currentIndex]
      : undefined;

  return (
    <div className="flex-1 flex flex-col px-3 py-2 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest text-text-dim">
          {label}
        </span>
        {currentValue !== undefined && (
          <span className="text-[10px] font-medium" style={{ color }}>
            {currentValue.toFixed(2)}
          </span>
        )}
      </div>
      {/* Chart */}
      <div ref={containerRef} className="flex-1 min-h-0">
        <svg
          ref={svgRef}
          width={dims.width}
          height={dims.height}
          className="block"
          preserveAspectRatio="none"
        />
      </div>
    </div>
  );
}
