import type { ReactNode } from 'react';
import { BrandLogo } from '../brand/BrandLogo';

export interface AuthShellProps {
  /** Tiêu đề lớn bằng font serif — "Chào mừng trở lại", "Tạo tài khoản"... */
  title: string;
  subtitle: string;
  /** Seed ảnh picsum cho nửa phải, mỗi trang một ảnh ổn định. */
  imageSeed: string;
  children: ReactNode;
}

/**
 * Khung chia đôi màn hình kiểu premium cho các trang tài khoản:
 * trái là form trên nền phẳng, phải là ảnh thời trang tràn mép với câu dẫn
 * serif. Ảnh ẩn dưới lg — di động chỉ còn form, không tải ảnh thừa.
 */
export function AuthShell({ title, subtitle, imageSeed, children }: Readonly<AuthShellProps>) {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-12 md:px-10">
        <div className="w-full max-w-[420px]">
          <div className="flex items-center gap-2">
            <BrandLogo markSize={30} wordmarkClassName="text-sm" />
            <span className="text-xs text-ink-muted">— tiệm quần áo</span>
          </div>
          <h1 className="mt-4 font-serif text-4xl leading-[1.1] md:text-[2.75rem]">{title}</h1>
          <p className="mt-3 text-ink-muted">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </div>
      </div>

      <div className="relative hidden bg-sunken lg:block">
        <img
          src={`https://picsum.photos/seed/${imageSeed}/1080/1350`}
          alt=""
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
        {/* Gradient tối dần về đáy chỉ để chữ đọc được — không phải backdrop-filter. */}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 via-black/10 to-transparent p-10">
          <figure className="max-w-md text-white">
            <div className="mb-6 h-px w-12 bg-white/40" />
            <blockquote className="font-serif text-2xl leading-snug italic">
              “Phong cách là cách bạn nói mình là ai mà không cần mở lời.”
            </blockquote>
            <figcaption className="label-block mt-4 text-white/70">— Rachel Zoe</figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}
