import { Package, Clock, CheckCircle2, Truck, XCircle, CreditCard, MapPin, ShieldAlert, Archive, Clipboard, Banknote, CheckCircle, Receipt } from 'lucide-react';

export const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; solidBg: string; icon: any }> = {
  CART: { label: 'Cart', color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700', solidBg: 'bg-gray-600', icon: Package },
  CHECKOUT: { label: 'Checkout', color: 'text-brand-500', bg: ' ', solidBg: 'bg-brand-500', icon: Package },
  REQUESTED_INVOICE: { label: 'Quote Requested', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', solidBg: 'bg-amber-600', icon: Receipt },
  INVOICE_GENERATED: { label: 'Invoice Ready', color: 'text-blue-500', bg: ' ', solidBg: 'bg-blue-500', icon: Receipt },
  AWAITING_PAYMENT: { label: 'Awaiting Payment', color: 'text-yellow-500', bg: ' ', solidBg: 'bg-yellow-500', icon: CreditCard },
  PENDING_VERIFICATION: { label: 'Verifying Payment', color: 'text-orange-500', bg: ' ', solidBg: 'bg-orange-500', icon: Clock },
  PAID: { label: 'Paid', color: 'text-green-500', bg: ' ', solidBg: 'bg-green-500', icon: CheckCircle2 },
  
  // SokoniMax Managed Logistics States
  SELLER_CONFIRMED: { label: 'Seller Confirmed', color: 'text-green-500', bg: ' ', solidBg: 'bg-green-500', icon: Clipboard },
  PREPARING: { label: 'Preparing', color: 'text-green-500', bg: ' ', solidBg: 'bg-green-500', icon: Package },
  PACKAGING: { label: 'Packaging', color: 'text-green-500', bg: ' ', solidBg: 'bg-green-500', icon: Archive },
  SHIPPED_TO_WAREHOUSE: { label: 'Shipped to Warehouse', color: 'text-blue-500', bg: ' ', solidBg: 'bg-blue-500', icon: Truck },
  RECEIVED_AT_WAREHOUSE: { label: 'At Warehouse', color: 'text-indigo-500', bg: ' ', solidBg: 'bg-indigo-500', icon: MapPin },
  AWAITING_DELIVERY_PAYMENT: { label: 'Delivery Payment Due', color: 'text-indigo-500', bg: ' ', solidBg: 'bg-indigo-500', icon: Banknote },
  PENDING_DELIVERY_VERIFICATION: { label: 'Verifying Delivery Fee', color: 'text-orange-500', bg: ' ', solidBg: 'bg-orange-500', icon: Clock },
  ASSIGNED_TRANSPORT: { label: 'Assigned Transport', color: 'text-indigo-500', bg: ' ', solidBg: 'bg-indigo-500', icon: CheckCircle },
  IN_TRANSIT: { label: 'In Transit', color: 'text-green-500', bg: ' ', solidBg: 'bg-green-500', icon: Truck },
  ARRIVED_AT_REGIONAL_WAREHOUSE: { label: 'Arrived at Regional Warehouse', color: 'text-green-500', bg: ' ', solidBg: 'bg-green-500', icon: CheckCircle2 },
  READY_FOR_VEHICLE_HANDOVER: { label: 'Ready for Handover', color: 'text-green-500', bg: ' ', solidBg: 'bg-green-500', icon: Truck },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', color: 'text-green-500', bg: ' ', solidBg: 'bg-green-500', icon: MapPin },
  
  PROCESSING: { label: 'Processing', color: 'text-green-500', bg: ' ', solidBg: 'bg-green-500', icon: Package },
  SHIPPED: { label: 'Shipped', color: 'text-green-500', bg: ' ', solidBg: 'bg-green-500', icon: Truck },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: 'text-blue-500', bg: ' ', solidBg: 'bg-blue-500', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'text-green-500', bg: ' ', solidBg: 'bg-green-500', icon: MapPin },
  COMPLETED: { label: 'Completed', color: 'text-green-500', bg: ' ', solidBg: 'bg-green-500', icon: CheckCircle2 },
  FAILED_DELIVERY: { label: 'Failed Delivery', color: 'text-red-500', bg: ' ', solidBg: 'bg-red-500', icon: XCircle },
  CANCELLED: { label: 'Cancelled', color: 'text-red-500', bg: ' ', solidBg: 'bg-red-500', icon: XCircle },
  EXPIRED: { label: 'Expired', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700', solidBg: 'bg-gray-500', icon: XCircle },
  DISPUTED: { label: 'Disputed', color: 'text-red-500', bg: ' ', solidBg: 'bg-red-500', icon: ShieldAlert },
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

export const DIRECT_TRACKING_STEPS = [
  'PAID',
  'SELLER_CONFIRMED',
  'PREPARING',
  'PACKAGING',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED'
];
export const SELLER_ADVANCE_MAP: Record<string, string> = {
  PAID: 'SELLER_CONFIRMED',
  SELLER_CONFIRMED: 'PREPARING',
  PREPARING: 'PACKAGING',
  PACKAGING: 'SHIPPED_TO_WAREHOUSE',  // default: platform route
  PROCESSING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
  OUT_FOR_DELIVERY: 'DELIVERED',
  DELIVERED: 'COMPLETED'
};

/**
 * CRIT-1: Fulfillment-type-aware next status for sellers.
 * Returns the correct next status string, or undefined if no action available.
 */
export function getSellerNextStatus(
  currentStatus: string,
  fulfillmentType: string,
  hasVehicles = false
): string | undefined {
  if (hasVehicles) {
    if (currentStatus === 'PAID') return 'PROCESSING';
    if (['PROCESSING', 'SELLER_CONFIRMED', 'PREPARING', 'PACKAGING',
         'SHIPPED_TO_WAREHOUSE', 'RECEIVED_AT_WAREHOUSE', 'ASSIGNED_TRANSPORT'].includes(currentStatus)) return 'SHIPPED';
    return undefined;
  }

  switch (currentStatus) {
    case 'PAID':         return 'SELLER_CONFIRMED';
    case 'SELLER_CONFIRMED': return 'PREPARING';
    case 'PREPARING':    return 'PACKAGING';
    case 'PACKAGING':
      // CRIT-1: Direct delivery skips warehouse; seller ships directly
      return (fulfillmentType === 'DIRECT_DELIVERY') ? 'SHIPPED' : 'SHIPPED_TO_WAREHOUSE';
    case 'PROCESSING':   return 'SHIPPED';
    case 'SHIPPED':
      // For DIRECT_DELIVERY, seller can mark DELIVERED themselves
      return (fulfillmentType === 'DIRECT_DELIVERY') ? 'DELIVERED' : 'DELIVERED';
    case 'OUT_FOR_DELIVERY': return 'DELIVERED';
    case 'DELIVERED':    return 'COMPLETED';
    default:             return undefined;
  }
}

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
