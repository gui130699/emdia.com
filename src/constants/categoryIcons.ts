import {
  Home,
  Utensils,
  Car,
  HeartPulse,
  Popcorn,
  GraduationCap,
  Wrench,
  Landmark,
  Ellipsis,
  Banknote,
  Briefcase,
  TrendingUp,
  ShoppingBag,
  Gift,
  Plane,
  Dumbbell,
  Circle,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  utensils: Utensils,
  car: Car,
  "heart-pulse": HeartPulse,
  popcorn: Popcorn,
  "graduation-cap": GraduationCap,
  wrench: Wrench,
  landmark: Landmark,
  ellipsis: Ellipsis,
  banknote: Banknote,
  briefcase: Briefcase,
  "trending-up": TrendingUp,
  "shopping-bag": ShoppingBag,
  gift: Gift,
  plane: Plane,
  dumbbell: Dumbbell,
};

export const CATEGORY_ICON_OPTIONS = Object.keys(CATEGORY_ICON_MAP);

export function getCategoryIcon(name: string): LucideIcon {
  return CATEGORY_ICON_MAP[name] ?? Circle;
}
