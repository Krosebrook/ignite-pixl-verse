import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSystemTheme = theme === "system";

  const themeIcon = mounted ? (
    resolvedTheme === "dark" ? (
      <Moon className="h-4 w-4 transition-transform duration-300" />
    ) : (
      <Sun className="h-4 w-4 transition-transform duration-300" />
    )
  ) : (
    <Sun className="h-4 w-4" />
  );

  const button = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "default"}
          className="w-full justify-start gap-2"
        >
          <div className="relative">
            {themeIcon}
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-2 flex-1">
              <span>Theme</span>
              {mounted && isSystemTheme && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  Auto
                </Badge>
              )}
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={cn(theme === "light" && "bg-accent")}
        >
          <Sun className="h-4 w-4 mr-2" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={cn(theme === "dark" && "bg-accent")}
        >
          <Moon className="h-4 w-4 mr-2" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={cn(theme === "system" && "bg-accent")}
        >
          <Monitor className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span>System</span>
            {mounted && isSystemTheme && (
              <span className="text-[10px] text-muted-foreground">
                Using {resolvedTheme}
              </span>
            )}
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">
          Theme {mounted && isSystemTheme && `(System: ${resolvedTheme})`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
