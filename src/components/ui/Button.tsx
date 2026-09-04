import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-xl font-bold transition-[background-color,border-color,color,box-shadow,filter,transform] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7115F]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-9 px-4 text-sm",
        size === "md" && "h-11 px-5 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        variant === "primary" &&
          "bg-[#A7115F] text-white shadow-[0_8px_18px_-10px_rgba(167,17,95,0.75)] hover:bg-[#8F0E52] hover:shadow-[0_10px_22px_-10px_rgba(167,17,95,0.8)]",
        variant === "secondary" &&
          "border border-[#A7115F]/25 bg-[#FFF7FB] text-[#8F0E52] shadow-sm hover:border-[#A7115F]/45 hover:bg-[#FCE7F3]",
        variant === "ghost" && "text-[#A7115F] hover:bg-[#FCE7F3]",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
      {...props}
    />
  );
}
