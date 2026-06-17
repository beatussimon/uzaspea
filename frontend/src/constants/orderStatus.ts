import { Package, Clock, CheckCircle2, Truck, XCircle, CreditCard, MapPin } from 'lucide-react';

export const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  CART: { label: 'Cart', color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700', icon: Package },
  CHECKOUT: { label: 'Checkout', color: 'text-brand-600', bg: 'bg-brand-100 dark:bg-brand-900/30', icon: Package },
  AWAITING_PAYMENT: { label: 'Awaiting Payment', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: CreditCard },
  PENDING_VERIFICATION: { label: 'Verifying Payment', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: Clock },
  PAID: { label: 'Paid', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  PROCESSING: { label: 'Processing', color: 'text-brand-600', bg: 'bg-brand-100 dark:bg-brand-900/30', icon: Package },
  SHIPPED: { label: 'Shipped', color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: MapPin },
  COMPLETED: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
  EXPIRED: { label: 'Expired', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700', icon: XCircle },
};

export const TRACKING_STEPS = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'];

export const SELLER_ADVANCE_MAP: Record<string, string> = {
  PAID: 'PROCESSING', PROCESSING: 'SHIPPED', SHIPPED: 'DELIVERED', DELIVERED: 'COMPLETED'
};

export const SHORT_STATUS_LABELS: Record<string, string> = {
  CART: 'Cart', CHECKOUT: 'Checkout', AWAITING_PAYMENT: 'Awaiting Pay', PENDING_VERIFICATION: 'Verifying',
  PAID: 'Paid', PROCESSING: 'Processing', SHIPPED: 'Shipped', DELIVERED: 'Delivered', COMPLETED: 'Completed', CANCELLED: 'Cancelled'
};
