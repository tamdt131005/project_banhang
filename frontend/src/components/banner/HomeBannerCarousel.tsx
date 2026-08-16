import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons';
import { useBannerCarousel } from '../../hooks/useBannerCarousel';
import type { ApiBanner } from '../../types/api';

export interface HomeBannerCarouselProps {
  banners: ApiBanner[];
}

function BannerImage({ banner, interactive = true }: Readonly<{ banner: ApiBanner; interactive?: boolean }>) {
  const image = <img src={banner.imageUrl} alt={banner.altText} decoding="async" className="size-full object-cover" />;
  if (!interactive || !banner.linkUrl) return image;
  return <a href={banner.linkUrl} aria-label={banner.name} className="block size-full">{image}</a>;
}

export function HomeBannerCarousel({ banners }: Readonly<HomeBannerCarouselProps>) {
  const carousel = useBannerCarousel(banners.length);
  if (banners.length === 0) return null;

  const current = banners[carousel.current] ?? banners[0]!;
  const previous = carousel.previous === null ? null : banners[carousel.previous];
  const enterClass = carousel.direction === 1 ? 'banner-enter-forward' : 'banner-enter-backward';
  const exitClass = carousel.direction === 1 ? 'banner-exit-forward' : 'banner-exit-backward';

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Banner quảng cáo"
      className="group relative h-[340px] overflow-hidden rounded-card bg-sunken md:h-[420px]"
      onMouseEnter={() => carousel.setHovered(true)}
      onMouseLeave={() => carousel.setHovered(false)}
      onFocus={() => carousel.setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) carousel.setFocusWithin(false);
      }}
    >
      {previous ? (
        <div key={`old-${previous.id}`} aria-hidden="true" className={`absolute inset-0 ${exitClass}`}>
          <BannerImage banner={previous} interactive={false} />
        </div>
      ) : null}
      <div key={current.id} className={`absolute inset-0 ${previous ? enterClass : ''}`}>
        <BannerImage banner={current} />
      </div>

      {banners.length > 1 ? (
        <>
          <button type="button" aria-label="Banner trước" onClick={carousel.previousSlide} className="absolute top-1/2 left-3 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface/85 text-ink opacity-100 shadow-sm transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <ChevronLeftIcon className="size-5" />
          </button>
          <button type="button" aria-label="Banner tiếp theo" onClick={carousel.next} className="absolute top-1/2 right-3 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface/85 text-ink opacity-100 shadow-sm transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <ChevronRightIcon className="size-5" />
          </button>
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2" role="group" aria-label="Chọn banner">
            {banners.map((banner, index) => (
              <button key={banner.id} type="button" aria-label={`Xem banner ${index + 1}: ${banner.name}`} aria-current={index === carousel.current ? 'true' : undefined} onClick={() => carousel.goTo(index, index >= carousel.current ? 1 : -1)} className={`h-2.5 w-2.5 rounded-full border border-white transition-opacity ${index === carousel.current ? 'bg-white' : 'bg-white/35'}`} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
