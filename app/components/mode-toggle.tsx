import { Moon, Sun } from "lucide-react"
import { Button } from "./ui/button"
import { useTheme } from "~/hooks/use-theme"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative flex items-center justify-center w-10 h-10 p-0 transition-colors rounded-full border-2 border-border bg-background shadow-sm"
      aria-label="Toggle theme"
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      tabIndex={0}
    >
      <span className="relative flex items-center justify-center w-6 h-6">
        <Sun
          className={`absolute transition-all duration-300 ease-in-out w-6 h-6 
            ${isDark ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"}`}
        />
        <Moon
          className={`absolute transition-all duration-300 ease-in-out w-6 h-6 
            ${isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"}`}
        />
      </span>
    </Button>
  )
}
