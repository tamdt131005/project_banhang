export interface BrandLogoProps {
  markSize?: number;
  wordmarkClassName?: string;
}

/**
 * Logo May An dùng biểu tượng kim/đường chỉ PNG nền trong suốt dùng chung
 * ở mọi khu vực của app.
 */
export function BrandLogo({
  markSize = 34,
  wordmarkClassName = 'text-lg',
}: Readonly<BrandLogoProps>) {

  return (
    <span className="inline-flex shrink-0 items-center gap-2" role="img" aria-label="May An">
      <img
        src="/brand-logo.png"
        alt=""
        width={markSize}
        height={markSize}
        className="shrink-0 object-contain"
      />

      <span
        aria-hidden="true"
        className={`leading-none font-bold tracking-[-0.03em] whitespace-nowrap uppercase ${wordmarkClassName}`}
      >
        <span className="text-ink">MAY</span> <span className="text-accent">AN</span>
      </span>
    </span>
  );
}

