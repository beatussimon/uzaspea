import { Package, Clock, CheckCircle2, Truck, XCircle, CreditCard, MapPin, ShieldAlert, Archive, Clipboard, Banknote, CheckCircle } from 'lucide-react';

export const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; solidBg: string; icon: any }> = {
  CART: { label: 'Cart', color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700', solidBg: 'bg-gray-600', icon: Package },
  CHECKOUT: { label: 'Checkout', color: 'text-brand-600', bg: 'bg-brand-100 dark:bg-brand-900/30', solidBg: 'bg-brand-600', icon: Package },
  AWAITING_PAYMENT: { label: 'Awaiting Payment', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', solidBg: 'bg-yellow-600', icon: CreditCard },
  PENDING_VERIFICATION: { label: 'Verifying Payment', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', solidBg: 'bg-orange-600', icon: Clock },
  PAID: { label: 'Paid', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', solidBg: 'bg-green-600', icon: CheckCircle2 },
  
  // SokoniMax Managed Logistics States
  SELLER_CONFIRMED: { label: 'Seller Confirmed', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', solidBg: 'bg-green-600', icon: Clipboard },
  PREPARING: { label: 'Preparing', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', solidBg: 'bg-green-600', icon: Package },
  PACKAGING: { label: 'Packaging', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', solidBg: 'bg-green-600', icon: Archive },
  SHIPPED_TO_WAREHOUSE: { label: 'Shipped to Warehouse', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', solidBg: 'bg-blue-600', icon: Truck },
  RECEIVED_AT_WAREHOUSE: { label: 'At Warehouse', color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30', solidBg: 'bg-indigo-600', icon: MapPin },
  AWAITING_DELIVERY_PAYMENT: { label: 'Delivery Payment Due', color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30', solidBg: 'bg-indigo-600', icon: Banknote },
  PENDING_DELIVERY_VERIFICATION: { label: 'Verifying Delivery Fee', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', solidBg: 'bg-orange-600', icon: Clock },
  ASSIGNED_TRANSPORT: { label: 'Assigned Transport', color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30', solidBg: 'bg-indigo-600', icon: CheckCircle },
  IN_TRANSIT: { label: 'In Transit', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/20', solidBg: 'bg-green-600', icon: Truck },
  ARRIVED_AT_REGIONAL_WAREHOUSE: { label: 'Arrived at Regional Warehouse', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', solidBg: 'bg-green-600', icon: CheckCircle2 },
  READY_FOR_VEHICLE_HANDOVER: { label: 'Ready for Handover', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', solidBg: 'bg-green-600', icon: Truck },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', solidBg: 'bg-green-600', icon: MapPin },
  
  PROCESSING: { label: 'Processing', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', solidBg: 'bg-green-600', icon: Package },
  SHIPPED: { label: 'Shipped', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10', solidBg: 'bg-green-600', icon: Truck },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', solidBg: 'bg-blue-600', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', solidBg: 'bg-green-600', icon: MapPin },
  COMPLETED: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100 dark:bg-green-900/30', solidBg: 'bg-green-700', icon: CheckCircle2 },
  FAILED_DELIVERY: { label: 'Failed Delivery', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', solidBg: 'bg-red-600', icon: XCircle },
  CANCELLED: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', solidBg: 'bg-red-600', icon: XCircle },
  EXPIRED: { label: 'Expired', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700', solidBg: 'bg-gray-500', icon: XCircle },
  DISPUTED: { label: 'Disputed', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', solidBg: 'bg-red-600', icon: ShieldAlert },
};

export const TRACKING_STEPS = [
  'PAID',
  'SELLER_CONFIRMED',
  'PREPARING',
  'PACKAGING',
  'SHIPPED_TO_WAREHOUSE',
  'RECEIVED_AT_WAREHOUSE',
  'AWAITING_DELIVERY_PAYMENT',
  'ASSIGNED_TRANSPORT',
  'IN_TRANSIT',
  'ARRIVED_AT_REGIONAL_WAREHOUSE',
  'READY_FOR_VEHICLE_HANDOVER',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
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
  OUT_FOR_DELIVERY: 'DELIVERED',
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
  SHIPPED_TO_WAREHOUSE: 'To Warehouse',
  RECEIVED_AT_WAREHOUSE: 'At Warehouse',
  AWAITING_DELIVERY_PAYMENT: 'Delivery Pay',
  PENDING_DELIVERY_VERIFICATION: 'Verifying Delivery',
  ASSIGNED_TRANSPORT: 'Transport',
  IN_TRANSIT: 'In Transit',
  ARRIVED_AT_REGIONAL_WAREHOUSE: 'Regional WH',
  READY_FOR_VEHICLE_HANDOVER: 'Handover',
  READY_FOR_PICKUP: 'Ready Pickup',
  PROCESSING: 'Processing', 
  SHIPPED: 'Shipped', 
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered', 
  COMPLETED: 'Completed', 
  CANCELLED: 'Cancelled', 
  FAILED_DELIVERY: 'Failed',
  DISPUTED: 'Disputed'
};
