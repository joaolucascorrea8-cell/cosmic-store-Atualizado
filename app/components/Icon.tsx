import type { SVGProps } from "react";
const paths = {
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  gamepad:
    "M6 8h12l3 9a2 2 0 0 1-3 2l-3-3H9l-3 3a2 2 0 0 1-3-2L6 8ZM7 10v4m-2-2h4m6-1h.01m3 2h.01",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  cart: "M2 3h3l3 13h11l3-9H6m3 14h.01M19 21h.01",
  user: "M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  shield: "m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7l8-4Zm-4 9 3 3 5-6",
  chat: "M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9ZM7 8h10M7 12h6",
  copy: "M9 9h12v12H9V9ZM15 5V3H3v12h2",
  package: "m12 3 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V8m-9 5v10M7 5l9 5",
  layout: "M3 3h18v18H3V3Zm0 6h18M9 9v12",
  tag: "M3 3h7l11 11-7 7L3 10V3Zm4 4h.01",
  grid: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7",
  star: "m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z",
  image: "M3 3h18v18H3V3Zm0 13 5-5 5 5 4-4 4 4M8 7h.01",
  chevron: "m9 5 7 7-7 7",
  bell: "M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M9 21h6",
  coins:
    "M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3Zm0 0v5c0 2-4 3-8 3s-8-1-8-3V6m16 5v5c0 2-4 3-8 3s-8-1-8-3v-5",
  plus: "M12 5v14M5 12h14",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Zm-10-6v6l4 2",
  upload: "M4 15v6h16v-6M12 16V3m-5 5 5-5 5 5",
};
export type IconName = keyof typeof paths;
export default function Icon({
  name,
  className = "h-5 w-5",
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
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
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
