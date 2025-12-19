import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const button = (
    <Button
      variant="ghost"
      size={isCollapsed ? "icon" : "default"}
      onClick={toggleTheme}
      className="w-full justify-start gap-2"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
      {!isCollapsed && <span>Toggle Theme</span>}
    </Button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">Toggle Theme</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
