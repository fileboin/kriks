import type { LucideIcon } from 'lucide-react';
import {
  Armchair,
  Bitcoin,
  Briefcase,
  Car,
  Cloud,
  Cpu,
  CreditCard,
  Dumbbell,
  Gift,
  Home,
  Laptop,
  MessageSquare,
  Package,
  PawPrint,
  Shirt,
  Smartphone,
  Wrench,
} from 'lucide-react';

/**
 * Shared marketplace category styling (icon + colors) for components that
 * are NOT ListingCard (which keeps its own internal copy, untouched by
 * locked decision). Values are kept identical so sponsored cards match the
 * ListingCard visual language exactly.
 *
 * TODO (with future approval): unify ListingCard onto this module and drop
 * its internal copy.
 */

export interface CategoryStyle {
  icon: LucideIcon;
  /** Colored category label. */
  text: string;
  /** Placeholder background tint. */
  bg: string;
  /** Placeholder icon tint. */
  iconColor: string;
}

const CATEGORY_STYLES = new Map<string, CategoryStyle>([
  ['telefoni', { icon: Smartphone, text: 'text-sky-400', bg: 'bg-sky-500/15', iconColor: 'text-sky-500/60' }],
  ['sim-esim', { icon: CreditCard, text: 'text-teal-400', bg: 'bg-teal-500/15', iconColor: 'text-teal-500/60' }],
  ['sms-otp', { icon: MessageSquare, text: 'text-violet-400', bg: 'bg-violet-500/15', iconColor: 'text-violet-500/60' }],
  ['racunari', { icon: Laptop, text: 'text-blue-400', bg: 'bg-blue-500/15', iconColor: 'text-blue-500/60' }],
  ['elektronika', { icon: Cpu, text: 'text-cyan-400', bg: 'bg-cyan-500/15', iconColor: 'text-cyan-500/60' }],
  ['kripto', { icon: Bitcoin, text: 'text-amber-400', bg: 'bg-amber-500/15', iconColor: 'text-amber-500/60' }],
  ['vozila', { icon: Car, text: 'text-red-400', bg: 'bg-red-500/15', iconColor: 'text-red-500/60' }],
  ['nekretnine', { icon: Home, text: 'text-emerald-400', bg: 'bg-emerald-500/15', iconColor: 'text-emerald-500/60' }],
  ['namestaj', { icon: Armchair, text: 'text-orange-400', bg: 'bg-orange-500/15', iconColor: 'text-orange-500/60' }],
  ['odeca', { icon: Shirt, text: 'text-pink-400', bg: 'bg-pink-500/15', iconColor: 'text-pink-500/60' }],
  ['sport', { icon: Dumbbell, text: 'text-lime-400', bg: 'bg-lime-500/15', iconColor: 'text-lime-500/60' }],
  ['ljubimci', { icon: PawPrint, text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/15', iconColor: 'text-fuchsia-500/60' }],
  ['usluge', { icon: Wrench, text: 'text-indigo-400', bg: 'bg-indigo-500/15', iconColor: 'text-indigo-500/60' }],
  ['saas-projekti', { icon: Cloud, text: 'text-violet-400', bg: 'bg-violet-500/15', iconColor: 'text-violet-500/60' }],
  ['posao', { icon: Briefcase, text: 'text-teal-400', bg: 'bg-teal-500/15', iconColor: 'text-teal-500/60' }],
  ['besplatno', { icon: Gift, text: 'text-green-400', bg: 'bg-green-500/15', iconColor: 'text-green-500/60' }],
  ['ostalo', { icon: Package, text: 'text-slate-400', bg: 'bg-slate-500/15', iconColor: 'text-slate-500/60' }],
]);

const DEFAULT_CATEGORY_STYLE: CategoryStyle = {
  icon: Package,
  text: 'text-slate-400',
  bg: 'bg-slate-500/15',
  iconColor: 'text-slate-500/60',
};

export function getCategoryStyle(value: string | undefined): CategoryStyle {
  return (value && CATEGORY_STYLES.get(value)) || DEFAULT_CATEGORY_STYLE;
}
