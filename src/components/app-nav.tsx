"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { memberDisplayName } from "@/lib/member-display";
import { useLogout, useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const links = [
  { href: "/", label: "Bảng", icon: LayoutGrid },
  { href: "/users", label: "Người dùng", icon: Users },
  { href: "/profile", label: "Hồ sơ", icon: UserRound },
];

/** Top navigation with shared-workspace links and session actions. */
export function AppNav() {
  const pathname = usePathname();
  const { data } = useSession();
  const logout = useLogout();
  const member = data?.member ?? null;

  return (
    <>
      {member ? (
        <nav className="ml-2 flex items-center gap-1 overflow-x-auto smooth-scroll">
          {links.map((link) => {
            const Icon = link.icon;
            const active =
              link.href === "/"
                ? pathname === "/" || pathname.startsWith("/boards")
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {member ? (
          <>
            <Badge variant="secondary" className="hidden max-w-[180px] truncate sm:inline-flex">
              {memberDisplayName(member)}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              Đăng xuất
            </Button>
          </>
        ) : null}
      </div>
    </>
  );
}
