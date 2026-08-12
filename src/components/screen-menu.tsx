import { useNavigate, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  ChevronDown,
  Coins,
  Film,
  LayoutDashboard,
  Library,
  ListVideo,
  Palette,
  Sparkles,
  UserRound,
} from "lucide-react";

export const SCREENS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/create", label: "New ad", icon: Sparkles },
  { to: "/series/new", label: "New ad series", icon: ListVideo },
  { to: "/ads", label: "My ads", icon: Film },
  { to: "/library", label: "Video library", icon: Library },
  { to: "/cast", label: "Cast", icon: UserRound },
  { to: "/brands", label: "Brands", icon: Palette },
  { to: "/credits", label: "Credits & top up", icon: Coins },
] as const;

export function BackButton() {
  const router = useRouter();
  const navigate = useNavigate();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
      return;
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <Button variant="ghost" size="sm" onClick={goBack} aria-label="Go back">
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden sm:inline">Back</span>
    </Button>
  );
}

export function ScreenMenu() {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm">
          Go to <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Screens</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SCREENS.map((s) => (
          <DropdownMenuItem key={s.to} onSelect={() => navigate({ to: s.to })}>
            <s.icon className="mr-2 h-4 w-4" /> {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
