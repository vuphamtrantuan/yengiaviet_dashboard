"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogout, useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const links = [
  { href: "/", label: "Bảng", icon: LayoutGrid },
  { href: "/users", label: "Người dùng", icon: Users },
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
        <nav className="ml-2 flex items-center gap-1">
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
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {member ? (
          <>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {member.name || member.email}
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
