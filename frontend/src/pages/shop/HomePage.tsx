import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { catalogApi } from '../../api/catalog';
import { ProductGrid } from '../../components/product/ProductGrid';
import { Alert } from '../../components/ui/Feedback';
import {
  BagIcon,
  ChevronRightIcon,
  HangerIcon,
  ReceiptIcon,
  SparkleIcon,
  TshirtIcon,
} from '../../components/ui/icons';
import { useCategoryLinks } from '../../hooks/useCategoryLinks';
import { errorMessage } from '../../lib/errors';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface HomePageProps {}

export function HomePage({}: Readonly<HomePageProps>) {
  const { linkFor } = useCategoryLinks();

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => catalogApi.categories().then((response) => response.categories),
  });

  const newest = useQuery({
    queryKey: ['products', { sort: 'newest', limit: 10 }],
    queryFn: () => catalogApi.products({ sort: 'newest', limit: 10 }),
  });

  // "Gợi ý" không có máy gợi ý thật phía sau, nên chỉ là danh sách giá mềm
  // trước — thứ tự khác hẳn hai khu trên để trang không lặp lại chính nó.
  const suggestions = useQuery({
    queryKey: ['products', { sort: 'price-asc', limit: 12 }],
    queryFn: () => catalogApi.products({ sort: 'price-asc', limit: 12 }),
  });

  const childCategories = categories.data?.flatMap((parent) => parent.children) ?? [];

  // Dải lối tắt kiểu sàn TMĐT: vòng tròn icon màu, mỗi ô là một đích thật.
  // Cặp màu nhạt/đậm theo đúng khuôn ORDER_STATUS_CLASS để hợp chế độ tối.
  const quickLinks = [
    {
      label: 'Hàng mới về',
      to: '/san-pham',
      icon: <SparkleIcon className="size-5" />,
      tone: 'bg-accent-soft text-accent',
    },
    {
      label: 'Đồ nam',
      to: linkFor('do-nam'),
      icon: <TshirtIcon className="size-5" />,
      tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    },
    {
      label: 'Đồ nữ',
      to: linkFor('do-nu'),
      icon: <HangerIcon className="size-5" />,
      tone: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
    },
    {
      label: 'Phụ kiện',
      to: linkFor('phu-kien'),
      icon: <BagIcon className="size-5" />,
      tone: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    },
    {
      label: 'Đơn mua',
      to: '/don-hang',
      icon: <ReceiptIcon className="size-5" />,
      tone: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    },
  ];

  // Cổng vào theo đối tượng (chuẩn Canifa/H&M) — ảnh lớn tạo mảng thị giác.
  const gateways = [
    { label: 'Đồ nam', to: linkFor('do-nam'), seed: 'chuan-cong-nam' },
    { label: 'Đồ nữ', to: linkFor('do-nu'), seed: 'chuan-cong-nu' },
    { label: 'Phụ kiện', to: linkFor('phu-kien'), seed: 'chuan-cong-phu-kien' },
  ];

  return (
    <div className="space-y-10">
      {/*
        Lookbook hero khổ lớn (chuẩn Routine/YODY/IVY moda): một mảng ảnh làm
        điểm dừng thị giác, chữ nằm trong dải gradient dành riêng bên trái —
        ngoại lệ có kiểm soát của luật "không chồng lấn" (DESIGN.md v2.2).
      */}
      <section className="relative overflow-hidden rounded-card bg-sunken">
        <img
          src="https://picsum.photos/seed/chuan-lookbook/1600/700"
          alt=""
          /* Nằm đầu trang nên tải ngay, không lazy. 1600px là đủ cho khung
             1280px — bản 1920 khiến picsum render chậm rõ rệt. */
          decoding="async"
          className="h-[340px] w-full object-cover md:h-[420px]"
        />
        <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-black/60 via-black/25 to-transparent p-6 md:p-12">
          <p className="label-block text-white/70">
            Chuẩn<span className="text-accent">.</span> — tiệm quần áo
          </p>
          <h1 className="mt-3 max-w-[14ch] font-serif text-[clamp(2rem,5vw,3.25rem)] leading-[1.08] font-bold text-white">
            Đồ cơ bản, đúng dáng
          </h1>
          <p className="mt-3 max-w-[38ch] text-sm text-white/85 md:text-base">
            Áo thun, sơ mi, quần jeans và phụ kiện cho cả nam nữ. Ghi rõ chất liệu và bảng size
            từng món.
          </p>
          <div className="mt-6">
            <Link
              to="/san-pham"
              className="inline-flex h-11 items-center rounded-control bg-accent px-6 text-sm font-semibold text-accent-ink transition-transform duration-[160ms] ease-snap active:translate-y-px"
            >
              Mua ngay
            </Link>
          </div>
        </div>
      </section>

      {/* Dải lối tắt kiểu sàn TMĐT — vòng tròn icon nhấc nhẹ khi trỏ chuột. */}
      <section aria-label="Lối tắt" className="rounded-card border border-line bg-surface px-4 py-5">
        <ul className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-5">
          {quickLinks.map((item) => (
            <li key={item.label}>
              <Link to={item.to} className="group flex flex-col items-center gap-2 text-center">
                <span
                  className={`grid size-12 place-items-center rounded-full transition-transform duration-[160ms] ease-snap group-hover:-translate-y-1 ${item.tone}`}
                >
                  {item.icon}
                </span>
                <span className="text-xs leading-tight">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Cổng danh mục theo đối tượng — bấm là lọc đúng nhánh. */}
      <section className="grid grid-cols-3 gap-3 md:gap-4">
        {gateways.map((gateway) => (
          <Link
            key={gateway.label}
            to={gateway.to}
            className="group relative overflow-hidden rounded-card bg-sunken"
          >
            <img
              src={`https://picsum.photos/seed/${gateway.seed}/600/750`}
              alt=""
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full object-cover transition-transform duration-[240ms] ease-snap group-hover:scale-105 sm:aspect-[3/4]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10 md:p-4">
              <p className="label-block text-white">{gateway.label}</p>
              <p className="mt-0.5 hidden text-xs text-white/75 sm:block">Mua ngay</p>
            </div>
          </Link>
        ))}
      </section>

      {/* Hàng chip danh mục cuộn ngang — toàn bộ danh mục con, bấm là lọc. */}
      {childCategories.length > 0 ? (
        <nav aria-label="Danh mục" className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-2">
            <Link
              to="/san-pham"
              className="rounded-control border border-line bg-surface px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors duration-[160ms] hover:border-accent hover:text-accent"
            >
              Tất cả
            </Link>
            {childCategories.map((category) => (
              <Link
                key={category.id}
                to={`/san-pham?categoryId=${category.id}`}
                className="rounded-control border border-line bg-surface px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors duration-[160ms] hover:border-accent hover:text-accent"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="label-block">Hàng mới về</h2>
          <Link to="/san-pham" className="inline-flex items-center gap-1 text-sm font-medium text-accent">
            Xem tất cả
            <ChevronRightIcon className="size-3.5" />
          </Link>
        </div>

        {newest.isError ? (
          <Alert>{errorMessage(newest.error)}</Alert>
        ) : (
          <ProductGrid products={newest.data?.items ?? []} loading={newest.isPending} skeletonCount={10} />
        )}
      </section>

      {/* Khu "gợi ý" kiểu Shopee: tiêu đề gạch chân màu nhấn + nút xem thêm. */}
      <section>
        <div className="rounded-card border border-line border-b-2 border-b-accent bg-surface py-3 text-center">
          <h2 className="label-block text-accent">Gợi ý hôm nay</h2>
        </div>

        <div className="mt-4">
          {suggestions.isError ? (
            <Alert>{errorMessage(suggestions.error)}</Alert>
          ) : (
            <ProductGrid
              products={suggestions.data?.items ?? []}
              loading={suggestions.isPending}
              skeletonCount={12}
            />
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/san-pham"
            className="inline-flex h-11 items-center rounded-control border border-line bg-surface px-10 text-sm font-medium transition-colors duration-[160ms] hover:bg-sunken"
          >
            Xem thêm sản phẩm
          </Link>
        </div>
      </section>
    </div>
  );
}
