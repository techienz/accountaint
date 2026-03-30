export function Sparkline({
  data,
  color = "currentColor",
  width = 140,
  height = 40,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 3;

  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Build gradient fill path
  const fillPath = [
    `M ${points[0].x},${height}`,
    `L ${points[0].x},${points[0].y}`,
    ...points.slice(1).map((p) => `L ${p.x},${p.y}`),
    `L ${points[points.length - 1].x},${height}`,
    "Z",
  ].join(" ");

  const gradientId = `sparkline-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg width={width} height={height} className="inline-block">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={3}
        fill={color}
      />
    </svg>
  );
}
