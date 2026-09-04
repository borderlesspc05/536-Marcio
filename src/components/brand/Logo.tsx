import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

type LogoProps = {
  className?: string;
  href?: string | null;
  priority?: boolean;
};

export function Logo({ className, href = "/", priority = false }: LogoProps) {
  const image = (
    <Image
      src="/brand/logo-transparent-v2.png"
      alt="CotaCondo"
      width={320}
      height={104}
      quality={100}
      priority={priority}
      sizes="180px"
      className={cn(
        "w-auto object-contain object-left",
        className || "h-8",
      )}
    />
  );

  if (!href) return image;
  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="CotaCondo">
      {image}
    </Link>
  );
}
