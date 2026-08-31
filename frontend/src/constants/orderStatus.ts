import { Package, Clock, CheckCircle2, Truck, XCircle, CreditCard, MapPin, ShieldAlert, Archive, Clipboard, Banknote, CheckCircle, Receipt, MessageSquare } from 'lucide-react';

export const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; solidBg: string; icon: any }> = {
  CART: { 
    label: 'Cart', 
    color: 'text-gray-600 dark:text-gray-400', 
    bg: 'bg-gray-500/10 border-gray-500/20', 
    dot: 'bg-gray-400', 
    solidBg: 'bg-gray-600', 
    icon: Package 
  },
  CHECKOUT: { 
    label: 'Checkout', 
    color: 'text-brand-500', 
    bg: 'bg-brand-500/10 border-brand-500/20', 
    dot: 'bg-brand-500', 
    solidBg: 'bg-brand-500', 
    icon: Package 
  },
  REQUESTED_INVOICE: { 
    label: 'Quote Requested', 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-500/10 border-amber-500/20', 
    dot: 'bg-amber-500', 
    solidBg: 'bg-amber-600', 
    icon: Receipt 
  },
  INVOICE_GENERATED: { 
    label: 'Invoice Ready', 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-500/10 border-blue-500/20', 
    dot: 'bg-blue-500', 
    solidBg: 'bg-blue-500', 
    icon: Receipt 
  },
  BUYER_COUNTERED: { 
    label: 'Counter Offer', 
    color: 'text-purple-600 dark:text-purple-400', 
    bg: 'bg-purple-500/10 border-purple-500/20', 
    dot: 'bg-purple-500', 
    solidBg: 'bg-purple-500', 
    icon: MessageSquare 
  },
  AWAITING_PAYMENT: { 
    label: 'Awaiting Payment', 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-500/10 border-amber-500/20', 
    dot: 'bg-amber-500', 
    solidBg: 'bg-amber-500', 
    icon: CreditCard 
  },
  PENDING_VERIFICATION: { 
    label: 'Verifying Payment', 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-500/10 border-amber-500/20', 
    dot: 'bg-amber-500', 
    solidBg: 'bg-amber-500', 
    icon: Clock 
  },
  PAID: { 
    label: 'Paid', 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-500/10 border-emerald-500/20', 
    dot: 'bg-emerald-500', 
    solidBg: 'bg-emerald-500', 
    icon: CheckCircle2 
  },
  PAID_PRODUCT: { 
    label: 'Product Paid', 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-500/10 border-emerald-500/20', 
    dot: 'bg-emerald-500', 
    solidBg: 'bg-emerald-500', 
    icon: CheckCircle2 
  },
  
  // SokoniMax Managed Logistics States
  SELLER_CONFIRMED: { 
    label: 'Confirmed', 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-500/10 border-emerald-500/20', 
    dot: 'bg-emerald-500', 
    solidBg: 'bg-emerald-500', 
    icon: Clipboard 
  },
  PREPARING: { 
    label: 'Preparing', 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-500/10 border-blue-500/20', 
    dot: 'bg-blue-500', 
    solidBg: 'bg-blue-500', 
    icon: Package 
  },
  PACKAGING: { 
    label: 'Packaging', 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-500/10 border-blue-500/20', 
    dot: 'bg-blue-500', 
    solidBg: 'bg-blue-500', 
    icon: Archive 
  },
  SHIPPED_TO_WAREHOUSE: { 
    label: 'Shipped to Hub', 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-500/10 border-blue-500/20', 
    dot: 'bg-blue-500', 
    solidBg: 'bg-blue-500', 
    icon: Truck 
  },
  RECEIVED_AT_WAREHOUSE: { 
    label: 'At Warehouse Hub', 
    color: 'text-purple-600 dark:text-purple-400', 
    bg: 'bg-purple-500/10 border-purple-500/20', 
    dot: 'bg-purple-500', 
    solidBg: 'bg-purple-500', 
    icon: MapPin 
  },
  AWAITING_DELIVERY_PAYMENT: { 
    label: 'Delivery Fee Due', 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-500/10 border-amber-500/20', 
    dot: 'bg-amber-500', 
    solidBg: 'bg-amber-500', 
    icon: Banknote 
  },
  PENDING_DELIVERY_VERIFICATION: { 
    label: 'Verifying Delivery Fee', 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-500/10 border-amber-500/20', 
    dot: 'bg-amber-500', 
    solidBg: 'bg-amber-500', 
    icon: Clock 
  },
  ASSIGNED_TRANSPORT: { 
    label: 'Assigned Fleet', 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-500/10 border-blue-500/20', 
    dot: 'bg-blue-500', 
    solidBg: 'bg-blue-500', 
    icon: CheckCircle 
  },
  IN_TRANSIT: { 
    label: 'In Transit', 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-500/10 border-blue-500/20', 
    dot: 'bg-blue-500', 
    solidBg: 'bg-blue-500', 
    icon: Truck 
  },
  ARRIVED_AT_REGIONAL_WAREHOUSE: { 
    label: 'At Regional Hub', 
    color: 'text-purple-600 dark:text-purple-400', 
    bg: 'bg-purple-500/10 border-purple-500/20', 
    dot: 'bg-purple-500', 
    solidBg: 'bg-purple-500', 
    icon: CheckCircle2 
  },
  READY_FOR_VEHICLE_HANDOVER: { 
    label: 'Ready for Handover', 
    color: 'text-purple-600 dark:text-purple-400', 
    bg: 'bg-purple-500/10 border-purple-500/20', 
    dot: 'bg-purple-500', 
    solidBg: 'bg-purple-500', 
    icon: Truck 
  },
  READY_FOR_PICKUP: { 
    label: 'Ready for Pickup', 
    color: 'text-purple-600 dark:text-purple-400', 
    bg: 'bg-purple-500/10 border-purple-500/20', 
    dot: 'bg-purple-500', 
    solidBg: 'bg-purple-500', 
    icon: MapPin 
  },
  
  PROCESSING: { 
    label: 'Processing', 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-500/10 border-blue-500/20', 
    dot: 'bg-blue-500', 
    solidBg: 'bg-blue-500', 
    icon: Package 
  },
  SHIPPED: { 
    label: 'Shipped', 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-500/10 border-blue-500/20', 
    dot: 'bg-blue-500', 
    solidBg: 'bg-blue-500', 
    icon: Truck 
  },
  OUT_FOR_DELIVERY: { 
    label: 'Out for Delivery', 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-500/10 border-blue-500/20', 
    dot: 'bg-blue-500', 
    solidBg: 'bg-blue-500', 
    icon: Truck 
  },
  DELIVERED: { 
    label: 'Delivered', 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-500/10 border-emerald-500/20', 
    dot: 'bg-emerald-500', 
    solidBg: 'bg-emerald-500', 
    icon: MapPin 
  },
  COMPLETED: { 
    label: 'Completed', 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-500/10 border-emerald-500/20', 
    dot: 'bg-emerald-500', 
    solidBg: 'bg-emerald-500', 
    icon: CheckCircle2 
  },
  FAILED_DELIVERY: { 
    label: 'Failed Delivery', 
    color: 'text-red-600 dark:text-red-400', 
    bg: 'bg-red-500/10 border-red-500/20', 
    dot: 'bg-red-500', 
    solidBg: 'bg-red-500', 
    icon: XCircle 
  },
  CANCELLED: { 
    label: 'Cancelled', 
    color: 'text-red-600 dark:text-red-400', 
    bg: 'bg-red-500/10 border-red-500/20', 
    dot: 'bg-red-500', 
    solidBg: 'bg-red-500', 
    icon: XCircle 
  },
  RETURNED_TO_WAREHOUSE: { 
    label: 'Returned to Hub', 
    color: 'text-orange-600 dark:text-orange-400', 
    bg: 'bg-orange-500/10 border-orange-500/20', 
    dot: 'bg-orange-500', 
    solidBg: 'bg-orange-500', 
    icon: Archive 
  },
  EXPIRED: { 
    label: 'Expired', 
    color: 'text-gray-600 dark:text-gray-400', 
    bg: 'bg-gray-500/10 border-gray-500/20', 
    dot: 'bg-gray-400', 
    solidBg: 'bg-gray-500', 
    icon: XCircle 
  },
  DISPUTED: { 
    label: 'Disputed', 
    color: 'text-red-600 dark:text-red-400', 
    bg: 'bg-red-500/10 border-red-500/20', 
    dot: 'bg-red-500', 
    solidBg: 'bg-red-500', 
    icon: ShieldAlert 
  },
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
  PACKAGING: 'SHIPPED_TO_WAREHOUSE',
  PROCESSING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
  OUT_FOR_DELIVERY: 'DELIVERED',
  DELIVERED: 'COMPLETED'
};

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
      if (fulfillmentType === 'SELLER_PICKUP') return 'READY_FOR_PICKUP';
      return (fulfillmentType === 'DIRECT_DELIVERY') ? 'SHIPPED' : 'SHIPPED_TO_WAREHOUSE';
    case 'READY_FOR_PICKUP':
      if (fulfillmentType === 'SELLER_PICKUP') return 'DELIVERED';
      return undefined;
    case 'PROCESSING':   return 'SHIPPED';
    case 'SHIPPED':
      return (fulfillmentType === 'DIRECT_DELIVERY') ? 'DELIVERED' : undefined;
    case 'OUT_FOR_DELIVERY': return (fulfillmentType === 'DIRECT_DELIVERY') ? 'DELIVERED' : undefined;
    case 'DELIVERED':    return undefined;
    default:             return undefined;
  }
}

export const SHORT_STATUS_LABELS: Record<string, string> = {
  CART: 'Cart', 
  CHECKOUT: 'Checkout', 
  AWAITING_PAYMENT: 'Awaiting Pay', 
  PENDING_VERIFICATION: 'Verifying',
  PAID: 'Paid',
  PAID_PRODUCT: 'Paid Product',
  SELLER_CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  PACKAGING: 'Packaging',
  SHIPPED_TO_WAREHOUSE: 'To Hub',
  RECEIVED_AT_WAREHOUSE: 'At Hub',
  AWAITING_DELIVERY_PAYMENT: 'Delivery Pay',
  PENDING_DELIVERY_VERIFICATION: 'Verifying Delivery',
  ASSIGNED_TRANSPORT: 'Transport',
  IN_TRANSIT: 'In Transit',
  ARRIVED_AT_REGIONAL_WAREHOUSE: 'Regional Hub',
  READY_FOR_VEHICLE_HANDOVER: 'Handover',
  READY_FOR_PICKUP: 'Ready Pickup',
  PROCESSING: 'Processing', 
  SHIPPED: 'Shipped', 
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered', 
  COMPLETED: 'Completed', 
  CANCELLED: 'Cancelled', 
  RETURNED_TO_WAREHOUSE: 'Returned Hub',
  FAILED_DELIVERY: 'Failed',
  DISPUTED: 'Disputed',
  BUYER_COUNTERED: 'Counter Offer'
};
