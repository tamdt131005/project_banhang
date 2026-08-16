import type { ReactNode } from 'react';

/**
 * Bộ icon nét mảnh dùng chung cho toàn dự án — SVG nội tuyến, không kéo
 * thêm font icon nào về (quy tắc DESIGN.md). Mọi icon cùng lưới 24×24,
 * nét 1.7, đầu nét bo tròn để đồng bộ độ đậm với chữ.
 */
function Icon({ children, className = 'size-4' }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export interface IconProps {
  className?: string;
}

export function UserIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </Icon>
  );
}

export function PinIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M12 21s-6.6-5.1-6.6-10.4a6.6 6.6 0 1 1 13.2 0C18.6 15.9 12 21 12 21Z" />
      <circle cx="12" cy="10.4" r="2.3" />
    </Icon>
  );
}

export function ReceiptIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21V3Z" />
      <path d="M9.5 8.5h5M9.5 12.5h5" />
    </Icon>
  );
}

export function ShieldIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M12 3l7 2.8v5.6c0 4.3-2.9 7.5-7 9.6-4.1-2.1-7-5.3-7-9.6V5.8L12 3Z" />
    </Icon>
  );
}

export function LogoutIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M9.5 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3.5" />
      <path d="M15 8l4 4-4 4M19 12H9.5" />
    </Icon>
  );
}

export function PencilIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M4.5 19.5l1-3.8L16.6 4.6a2 2 0 0 1 2.8 2.8L8.3 18.5l-3.8 1Z" />
    </Icon>
  );
}

export function MinusIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M5.5 12h13" />
    </Icon>
  );
}

export function PlusIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Icon>
  );
}

export function BagIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M6 8h12l-1.2 12.2a1 1 0 0 1-1 .8H8.2a1 1 0 0 1-1-.8L6 8Z" />
      <path d="M9 10V6a3 3 0 0 1 6 0v4" />
    </Icon>
  );
}

export function SearchIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.4-3.4" />
    </Icon>
  );
}

export function ChevronDownIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function ChevronRightIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

export function ChevronLeftIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  );
}

export function ArrowLeftIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Icon>
  );
}

export function TruckIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M14 16.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v9.5h2" />
      <path d="M9.2 16.5H14" />
      <path d="M14 9h3.3a1 1 0 0 1 .8.4l2.6 3.3a1 1 0 0 1 .3.6v3.2h-2.1" />
      <circle cx="7" cy="16.8" r="1.8" />
      <circle cx="16.8" cy="16.8" r="1.8" />
    </Icon>
  );
}

export function WalletIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M19 8V6.5A1.5 1.5 0 0 0 17.5 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6" />
      <path d="M15.8 13.5h.2" />
    </Icon>
  );
}

export function TrashIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
      <path d="m6.5 7 .7 12a1.5 1.5 0 0 0 1.5 1.5h6.6a1.5 1.5 0 0 0 1.5-1.5l.7-12" />
      <path d="M10 11v5.5M14 11v5.5" />
    </Icon>
  );
}

export function CheckIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="m5 12.5 4.7 4.7L19 7.5" />
    </Icon>
  );
}

export function XIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </Icon>
  );
}

export function ClockIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Icon>
  );
}

export function BoxIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5" />
      <path d="M12 12v9" />
    </Icon>
  );
}

export function TagIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M3.5 12V5A1.5 1.5 0 0 1 5 3.5h7l8.5 8.5a1.5 1.5 0 0 1 0 2.1L14.1 20.5a1.5 1.5 0 0 1-2.1 0L3.5 12Z" />
      <path d="M8 8h.2" />
    </Icon>
  );
}

export function FilterIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M4 5h16l-6.3 7.2v5.3l-3.4 1.7v-7L4 5Z" />
    </Icon>
  );
}

export function InfoIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11.2v4.8" />
      <path d="M12 8h.2" />
    </Icon>
  );
}

export function CheckCircleIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.3 2.4 2.4 4.6-5" />
    </Icon>
  );
}

export function AlertCircleIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.8" />
      <path d="M12 16h.2" />
    </Icon>
  );
}

export function SunIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </Icon>
  );
}

export function SparkleIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M12 3.5 13.9 9l5.6 2-5.6 2L12 18.5 10.1 13l-5.6-2 5.6-2L12 3.5Z" />
    </Icon>
  );
}

export function TshirtIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M9 4 4.5 6.3l1.5 3 2-1v10.2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V8.3l2 1 1.5-3L15 4a3 3 0 0 1-6 0Z" />
    </Icon>
  );
}

export function HangerIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M12 6.5a2 2 0 1 1 2-2" />
      <path d="m12 6.5 8.6 6.2a1 1 0 0 1-.6 1.8H4a1 1 0 0 1-.6-1.8L12 6.5Z" />
    </Icon>
  );
}

export function UsersIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M3.8 19a5.7 5.7 0 0 1 11.4 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" />
      <path d="M17.4 13.6a5.7 5.7 0 0 1 2.8 4.4" />
    </Icon>
  );
}

export function MessageIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5.5 4v-4.7A2.5 2.5 0 0 1 4 13.8V5.5Z" />
      <path d="M8 8.5h8M8 12h5" />
    </Icon>
  );
}

export function StarIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="m12 4 2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8L12 4Z" />
    </Icon>
  );
}

export function GaugeIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M4 17.5a8.5 8.5 0 1 1 16 0" />
      <path d="m12 14 3.5-3.9" />
      <circle cx="12" cy="15.2" r="1.4" />
    </Icon>
  );
}

export function WarehouseIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M3.5 20V8.4L12 4.5l8.5 3.9V20" />
      <path d="M7.5 20v-6.5h9V20" />
      <path d="M7.5 16.8h9" />
    </Icon>
  );
}

export function StoreIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M4.2 9.5 5.2 4.5h13.6l1 5" />
      <path d="M3.8 9.5a2.6 2.6 0 0 0 5.2 0 2.6 2.6 0 0 0 5.2 0 2.6 2.6 0 0 0 5.2 0" />
      <path d="M5.5 12.5v7h13v-7" />
      <path d="M10 19.5v-4.5h4v4.5" />
    </Icon>
  );
}

export function CameraIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.9l1.2-1.8a1 1 0 0 1 .84-.45h5.12a1 1 0 0 1 .84.45L16.6 7h1.9A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="12" cy="13" r="3.2" />
    </Icon>
  );
}

export function MoonIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z" />
    </Icon>
  );
}

export function SendIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </Icon>
  );
}

export function RefreshIcon({ className }: Readonly<IconProps>) {
  return (
    <Icon {...(className === undefined ? {} : { className })}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </Icon>
  );
}
