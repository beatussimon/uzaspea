import { Package, Clock, CheckCircle2, Truck, XCircle, CreditCard, MapPin, ShieldAlert, Archive, Clipboard } from 'lucide-react';

export const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  CART: { label: 'Cart', color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700', icon: Package },
  CHECKOUT: { label: 'Checkout', color: 'text-brand-600', bg: 'bg-brand-100 dark:bg-brand-900/30', icon: Package },
  AWAITING_PAYMENT: { label: 'Awaiting Payment', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: CreditCard },
  PENDING_VERIFICATION: { label: 'Verifying Payment', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: Clock },
  PAID: { label: 'Paid', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  
  // SokoniMax Managed Logistics States
  SELLER_CONFIRMED: { label: 'Seller Confirmed', color: 'text-brand-600', bg: 'bg-brand-100 dark:bg-brand-900/30', icon: Clipboard },
  PREPARING: { label: 'Preparing', color: 'text-brand-600', bg: 'bg-brand-100 dark:bg-brand-900/30', icon: Package },
  PACKAGING: { label: 'Packaging', color: 'text-brand-600', bg: 'bg-brand-100 dark:bg-brand-900/30', icon: Archive },
  SHIPPED_TO_WAREHOUSE: { label: 'Shipped to Hub', color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/10', icon: Truck },
  RECEIVED_AT_WAREHOUSE: { label: 'Received at Hub', color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/10', icon: Package },
  ASSIGNED_TRANSPORT: { label: 'Assigned Transport', color: 'text-brand-700', bg: 'bg-brand-100 dark:bg-brand-900/20', icon: Truck },
  IN_TRANSIT: { label: 'In Transit', color: 'text-brand-700', bg: 'bg-brand-100 dark:bg-brand-900/20', icon: Truck },
  ARRIVED_AT_REGIONAL_WAREHOUSE: { label: 'Arrived at Regional Hub', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: MapPin },
  
  PROCESSING: { label: 'Processing', color: 'text-brand-600', bg: 'bg-brand-100 dark:bg-brand-900/30', icon: Package },
  SHIPPED: { label: 'Shipped', color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/10', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: MapPin },
  COMPLETED: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
  EXPIRED: { label: 'Expired', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700', icon: XCircle },
  DISPUTED: { label: 'Disputed', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', icon: ShieldAlert },
};

export const TRACKING_STEPS = [
  'PAID',
  'SELLER_CONFIRMED',
  'PREPARING',
  'PACKAGING',
  'SHIPPED_TO_WAREHOUSE',
  'RECEIVED_AT_WAREHOUSE',
  'IN_TRANSIT',
  'ARRIVED_AT_REGIONAL_WAREHOUSE',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'COMPLETED'
];

export const SELLER_ADVANCE_MAP: Record<string, string> = {
  PAID: 'SELLER_CONFIRMED',
  SELLER_CONFIRMED: 'PREPARING',
  PREPARING: 'PACKAGING',
  PACKAGING: 'SHIPPED_TO_WAREHOUSE',
  PROCESSING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
  DELIVERED: 'COMPLETED'
};

export const SHORT_STATUS_LABELS: Record<string, string> = {
  CART: 'Cart', 
  CHECKOUT: 'Checkout', 
  AWAITING_PAYMENT: 'Awaiting Pay', 
  PENDING_VERIFICATION: 'Verifying',
  PAID: 'Paid',
  SELLER_CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  PACKAGING: 'Packaging',
  SHIPPED_TO_WAREHOUSE: 'To Hub',
  RECEIVED_AT_WAREHOUSE: 'At Hub',
  ASSIGNED_TRANSPORT: 'Transport',
  IN_TRANSIT: 'In Transit',
  ARRIVED_AT_REGIONAL_WAREHOUSE: 'Regional Hub',
  READY_FOR_PICKUP: 'Ready Pickup',
  PROCESSING: 'Processing', 
  SHIPPED: 'Shipped', 
  DELIVERED: 'Delivered', 
  COMPLETED: 'Completed', 
  CANCELLED: 'Cancelled', 
  DISPUTED: 'Disputed'
};
