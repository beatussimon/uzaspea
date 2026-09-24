import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, ChevronDown, ChevronUp, MapPin, Check, Plus, Edit2, Trash2, ArrowLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useUserLocation } from '../context/LocationContext';
import api from '../api';
import axios from 'axios';
import toast from 'react-hot-toast';
import SafeImage from '../components/SafeImage';
import { AddressAutocomplete, TZ_REGIONS } from '../components/AddressAutocomplete';
import {
  SUPPORTED_COUNTRIES,
  CountryInfo,
  SavedAddress,
  detectCountryFromAddress,
  getDefaultCountry,
  getSavedAddresses,
  saveAddress,
  deleteAddress
} from '../services/addressService';

const CITIES_COORDS: Record<string, { lat: number; lng: number; code: string }> = {
  'Dar es Salaam': { lat: -6.8161, lng: 39.2803, code: 'WH-DAR-ES-SALAAM-01' },
  'Mwanza': { lat: -2.5167, lng: 32.9000, code: 'WH-MWANZA-01' },
  'Arusha': { lat: -3.3667, lng: 36.6833, code: 'WH-ARUSHA-01' },
  'Dodoma': { lat: -6.1730, lng: 35.7419, code: 'WH-DODOMA-01' },
  'Mbeya': { lat: -8.9000, lng: 33.4500, code: 'WH-MBEYA-01' },
  'Morogoro': { lat: -6.8278, lng: 37.6591, code: 'WH-MOROGORO-01' },
  'Tanga': { lat: -5.0667, lng: 39.1000, code: 'WH-TANGA-01' },
  'Zanzibar': { lat: -6.1659, lng: 39.2026, code: 'WH-ZANZIBAR-URBANWEST-01' },
};

const DEFAULT_FULFILLMENT_OPTIONS = [
  {
    fulfillment_type: 'PLATFORM_DELIVERY',
    name: 'Fulfilled by SokoniMax',
    description: 'Item verified at our local hub before secure delivery.',
    shipping_method: 'DELIVERY'
  },
  {
    fulfillment_type: 'DIRECT_DELIVERY',
    name: 'Direct Delivery by Seller',
    description: 'Seller delivers directly. Contact seller for delivery fee.',
    shipping_method: 'DELIVERY'
  },
  {
    fulfillment_type: 'WAREHOUSE_PICKUP',
    name: 'Warehouse Pickup',
    description: 'Pick up your package directly from our local hub.',
    shipping_method: 'PICKUP'
  },
  {
    fulfillment_type: 'SELLER_PICKUP',
    name: 'Seller Pickup',
    description: 'Pick up directly from the seller.',
    shipping_method: 'PICKUP'
  }
];

const parsePhoneNumber = (rawPhone: string, fallbackCountry: CountryInfo): { country: CountryInfo; localDigits: string } => {
  if (!rawPhone) return { country: fallbackCountry, localDigits: '' };
  const clean = rawPhone.trim().replace(/\s+/g, '');

  for (const c of SUPPORTED_COUNTRIES) {
    if (clean.startsWith(c.dialCode)) {
      const digits = clean.slice(c.dialCode.length).replace(/^0+/, '');
      return { country: c, localDigits: digits.slice(0, c.digitCount || 9) };
    }
    const noPlus = c.dialCode.replace('+', '');
    if (clean.startsWith(noPlus) && clean.length > 8) {
      const digits = clean.slice(noPlus.length).replace(/^0+/, '');
      return { country: c, localDigits: digits.slice(0, c.digitCount || 9) };
    }
  }

  const digits = clean.replace(/^0+/, '');
  return { country: fallbackCountry, localDigits: digits.slice(0, fallbackCountry.digitCount || 9) };
};

export const CheckoutPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const merchant = searchParams.get('merchant') || '';
  const orderIdParam = searchParams.get('orderId');

  const { items, clearCartByMerchant } = useCart();
  const [invoiceOrder, setInvoiceOrder] = useState<any | null>(null);
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  // If completing an existing invoice/quote order
  useEffect(() => {
    if (orderIdParam) {
      api.get(`/api/orders/${orderIdParam}/`).then(res => {
        setInvoiceOrder(res.data);
      }).catch(err => {
        console.error('Failed to load invoice order for checkout', err);
      });
    }
  }, [orderIdParam]);
  
  const checkoutItems = useMemo(() => {
    if (invoiceOrder && invoiceOrder.items) {
      return invoiceOrder.items.map((i: any) => ({
        productId: i.variant ? `${i.product}-${i.variant}` : i.product,
        name: i.product_name,
        price: Number(i.price),
        stock: 9999,
        quantity: Number(i.quantity),
        image: i.product_image || '',
        slug: i.product_slug || '',
        seller_username: i.seller_username || merchant,
        requires_quote: false,
      }));
    }
    return items.filter(i => (i.seller_username || 'Unknown Store') === merchant);
  }, [items, merchant, invoiceOrder]);

  const checkoutTotal = useMemo(() => checkoutItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0), [checkoutItems]);
  const hasQuoteItem = useMemo(() => checkoutItems.some((i: any) => i.requires_quote), [checkoutItems]);

  const [submitting, setSubmitting] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [fulfillmentType, setFulfillmentType] = useState<string>('PLATFORM_DELIVERY');
  const [deliverySpeed, setDeliverySpeed] = useState<'standard' | 'express' | 'economy'>('standard');
  const [fulfillmentOptions, setFulfillmentOptions] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  
  const [selectedCity, setSelectedCity] = useState('Dar es Salaam');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');

  const [hasHistoricalPrice, setHasHistoricalPrice] = useState(false);
  const [historicalPrice, setHistoricalPrice] = useState<number | null>(null);

  const [sellerCoords, setSellerCoords] = useState<{ lat: number; lng: number; region?: string } | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [citiesCoords, setCitiesCoords] = useState<Record<string, { lat: number; lng: number; code: string }>>({});
  const [regionsData, setRegionsData] = useState<any[]>([]);

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    deliveryAddress: '',
    notes: '',
  });

  const currentUsername = localStorage.getItem('username') || undefined;
  const { location: userLoc, ensureLocation } = useUserLocation();

  // Address & Country States
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(() => getDefaultCountry(currentUsername));
  const [localPhone, setLocalPhone] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false);

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => getSavedAddresses(currentUsername));
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(() => {
    const list = getSavedAddresses(currentUsername);
    if (list.length > 0) {
      return (list.find(a => a.isDefault) || list[0]).id;
    }
    return null;
  });
  const [isEnteringNewAddress, setIsEnteringNewAddress] = useState<boolean>(() => {
    const list = getSavedAddresses(currentUsername);
    return list.length === 0;
  });
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [shouldSaveAddress, setShouldSaveAddress] = useState(true);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);

  const addressDropdownRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addressDropdownRef.current && !addressDropdownRef.current.contains(e.target as Node)) {
        setShowAddressDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applySavedAddress = (addr: SavedAddress) => {
    const matchedCountry = SUPPORTED_COUNTRIES.find(c => c.code === addr.countryCode) ||
      SUPPORTED_COUNTRIES.find(c => c.dialCode === addr.dialCode) ||
      SUPPORTED_COUNTRIES[0];
    
    setSelectedCountry(matchedCountry);
    const parsed = parsePhoneNumber(addr.phone, matchedCountry);
    setLocalPhone(parsed.localDigits);

    const isRawCoords = (str?: string | null) => !str || /^-?\d+\.\d+,\s*-?\d+\.\d+/.test(str.trim()) || /^GPS:/i.test(str.trim());
    const cleanSavedAddr = isRawCoords(addr.deliveryAddress)
      ? (addr.district ? `${addr.district}, ${addr.city}` : addr.city || 'Current Location')
      : addr.deliveryAddress;

    setForm(prev => ({
      ...prev,
      fullName: addr.fullName,
      phone: addr.phone,
      deliveryAddress: cleanSavedAddr,
      notes: addr.notes || '',
    }));

    if (addr.city) setSelectedCity(addr.city);
    if (addr.district) setSelectedDistrict(addr.district);
    if (addr.coords) setDeliveryCoords(addr.coords);
  };

  // Load seller coordinates
  useEffect(() => {
    const fetchSellerCoords = async () => {
      if (checkoutItems.length > 0) {
        const sellerUsername = checkoutItems[0].seller_username;
        if (sellerUsername) {
          try {
            const res = await api.get(`/api/profiles/${sellerUsername}/`);
            if (res.data.latitude && res.data.longitude) {
              setSellerCoords({
                lat: parseFloat(res.data.latitude),
                lng: parseFloat(res.data.longitude),
                region: res.data.location
              });
            } else if (res.data.location) {
               setSellerCoords({ lat: -6.8161, lng: 39.2803, region: res.data.location });
            }
          } catch (err) {
            console.error('Failed to fetch seller coords', err);
          }
        }
      }
    };
    fetchSellerCoords();
  }, [checkoutItems]);

  // Load saved address or user profile prefill
  useEffect(() => {
    const username = localStorage.getItem('username') || undefined;
    const addrs = getSavedAddresses(username);
    setSavedAddresses(addrs);

    if (addrs.length > 0) {
      const def = addrs.find(a => a.isDefault) || addrs[0];
      setSelectedSavedAddressId(def.id);
      applySavedAddress(def);
      setIsEnteringNewAddress(false);
    } else {
      setIsEnteringNewAddress(true);
      const defCountry = getDefaultCountry(username);
      setSelectedCountry(defCountry);

      if (username) {
        api.get(`/api/profiles/${username}/`).then(res => {
          const data = res.data;
          const fullName = `${data.user?.first_name || ''} ${data.user?.last_name || ''}`.trim() || data.username || '';
          const phone = data.phone_number || '';
          const parsed = parsePhoneNumber(phone, defCountry);
          setSelectedCountry(parsed.country);
          setLocalPhone(parsed.localDigits);
          
          setForm(prev => ({
            ...prev,
            fullName: prev.fullName || fullName,
            phone: parsed.localDigits ? `${parsed.country.dialCode}${parsed.localDigits}` : phone,
          }));

          if (data.location) {
            const locLower = data.location.toLowerCase();
            const matchedRegion = TZ_REGIONS.find(r => locLower.includes(r.toLowerCase()));
            if (matchedRegion) {
              setSelectedCity(matchedRegion);
            }
          }
        }).catch(err => {
          console.error('Failed to fetch user profile', err);
        });
      }
    }
  }, []);

  const handleLocalPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    const cleanVal = val.trim();

    // Check if pasted with country dial code (e.g. +254 712... or 254712...)
    let matchedCountry: CountryInfo | undefined;
    for (const c of SUPPORTED_COUNTRIES) {
      if (cleanVal.startsWith(c.dialCode)) {
        matchedCountry = c;
        val = cleanVal.slice(c.dialCode.length);
        break;
      }
      const noPlus = c.dialCode.replace('+', '');
      if (cleanVal.startsWith(noPlus) && cleanVal.length > 8) {
        matchedCountry = c;
        val = cleanVal.slice(noPlus.length);
        break;
      }
    }

    const activeCountry = matchedCountry || selectedCountry;
    if (matchedCountry && matchedCountry.code !== selectedCountry.code) {
      setSelectedCountry(matchedCountry);
    }

    // Strip non-digit characters and leading zero, clamp strictly to country's expected digit count
    const maxDigits = activeCountry.digitCount || 9;
    const sanitized = val.replace(/\D/g, '').replace(/^0+/, '').slice(0, maxDigits);
    setLocalPhone(sanitized);

    const full = sanitized ? `${activeCountry.dialCode}${sanitized}` : '';
    setForm(prev => ({ ...prev, phone: full }));
  };

  const handleSaveEditedAddress = () => {
    if (!form.fullName || !form.phone) {
      toast.error(t('fill_name_phone', 'Please provide recipient name and phone number.'));
      return;
    }
    const expectedDigits = selectedCountry.digitCount || 9;
    const cleanDigits = localPhone.trim().replace(/\D/g, '').replace(/^0+/, '');
    if (cleanDigits.length !== expectedDigits) {
      toast.error(
        t(
          'phone_length_mismatch',
          `Phone number must be exactly ${expectedDigits} digits for ${selectedCountry.name} (after ${selectedCountry.dialCode}).`
        )
      );
      return;
    }
    if (shippingMethod === 'DELIVERY' && !form.deliveryAddress) {
      toast.error(t('fill_address', 'Please provide a delivery location.'));
      return;
    }
    const username = localStorage.getItem('username') || undefined;
    const updated = saveAddress({
      id: selectedSavedAddressId || undefined,
      fullName: form.fullName,
      phone: form.phone,
      countryCode: selectedCountry.code,
      dialCode: selectedCountry.dialCode,
      deliveryAddress: form.deliveryAddress,
      city: selectedCity,
      district: selectedDistrict,
      coords: deliveryCoords || undefined,
      notes: form.notes,
    }, username);
    const refreshed = getSavedAddresses(username);
    setSavedAddresses(refreshed);
    setSelectedSavedAddressId(updated.id);
    setIsEditingAddress(false);
    toast.success(t('address_updated', 'Address updated successfully!'));
  };

  const handleDeleteSavedAddress = (id: string) => {
    const username = localStorage.getItem('username') || undefined;
    const remaining = deleteAddress(id, username);
    setSavedAddresses(remaining);
    if (remaining.length > 0) {
      const next = remaining[0];
      setSelectedSavedAddressId(next.id);
      applySavedAddress(next);
    } else {
      setIsEnteringNewAddress(true);
      setSelectedSavedAddressId(null);
    }
    toast.success(t('address_deleted', 'Address removed.'));
  };

  // Load regions list
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const res = await api.get('/api/locations/regions/');
        setRegionsData(res.data.results || res.data || []);
      } catch (err) {
        console.error('Failed to load regions', err);
      }
    };
    fetchRegions();
  }, []);

  // Load warehouses list
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await api.get('/api/warehouses/warehouses/');
        const list = res.data.results || res.data || [];
        setWarehouses(list);
        
        const dynamicCoords: Record<string, { lat: number; lng: number; code: string }> = {};
        list.forEach((w: any) => {
          if (w.region_name) {
            dynamicCoords[w.region_name] = {
              lat: Number(w.latitude ?? -6.3690),
              lng: Number(w.longitude ?? 34.8888),
              code: w.code
            };
          }
        });
        
        if (Object.keys(dynamicCoords).length > 0) {
          setCitiesCoords(dynamicCoords);
        } else {
          const fallback: any = {};
          Object.entries(CITIES_COORDS).forEach(([k, v]) => {
            fallback[k] = { ...v, code: k === 'Mwanza' ? 'WH-MWANZA-01' : 'WH-DAR-ES-SALAAM-01' };
          });
          setCitiesCoords(fallback);
        }
      } catch (err) {
        console.error('Failed to load warehouses list', err);
        const fallback: any = {};
        Object.entries(CITIES_COORDS).forEach(([k, v]) => {
          fallback[k] = { ...v, code: k === 'Mwanza' ? 'WH-MWANZA-01' : 'WH-DAR-ES-SALAAM-01' };
        });
        setCitiesCoords(fallback);
      }
    };
    fetchWarehouses();
  }, []);

  // Robust warehouse resolution helper by name, district, or coordinates
  const resolveDestinationWarehouse = (
    cityName: string,
    coordsParam?: { lat: number; lng: number } | null
  ): { code: string; lat: number; lng: number; regionName: string } => {
    // 1. Direct match in citiesCoords
    if (citiesCoords[cityName]) {
      return { ...citiesCoords[cityName], regionName: cityName };
    }
    // 2. Direct match in CITIES_COORDS
    if (CITIES_COORDS[cityName]) {
      return { ...CITIES_COORDS[cityName], regionName: cityName };
    }
    // 3. Partial or case-insensitive match in citiesCoords
    const cleanLower = (cityName || '').toLowerCase().trim();
    if (cleanLower) {
      const matchingKey = Object.keys(citiesCoords).find(k => {
        const kLower = k.toLowerCase();
        return kLower === cleanLower || kLower.includes(cleanLower) || cleanLower.includes(kLower);
      });
      if (matchingKey && citiesCoords[matchingKey]) {
        return { ...citiesCoords[matchingKey], regionName: matchingKey };
      }
      // 4. District matching from regionsData
      for (const r of regionsData) {
        if (r.districts?.some((d: any) => d.name.toLowerCase() === cleanLower || cleanLower.includes(d.name.toLowerCase()))) {
          if (citiesCoords[r.name]) {
            return { ...citiesCoords[r.name], regionName: r.name };
          }
          if (CITIES_COORDS[r.name]) {
            return { ...CITIES_COORDS[r.name], regionName: r.name };
          }
        }
      }
    }
    // 5. Nearest warehouse by coordinates (deliveryCoords or coordsParam)
    const targetCoords = coordsParam || deliveryCoords;
    if (targetCoords && warehouses.length > 0) {
      let nearest = warehouses[0];
      let minDist = Infinity;
      for (const w of warehouses) {
        if (w.latitude != null && w.longitude != null) {
          const dist = Math.hypot(Number(w.latitude) - targetCoords.lat, Number(w.longitude) - targetCoords.lng);
          if (dist < minDist) {
            minDist = dist;
            nearest = w;
          }
        }
      }
      if (nearest) {
        return {
          code: nearest.code,
          lat: Number(nearest.latitude || -6.8161),
          lng: Number(nearest.longitude || 39.2803),
          regionName: nearest.region_name || 'Dar es Salaam'
        };
      }
    }
    // 6. Default fallback to Dar es Salaam Hub
    return {
      code: citiesCoords['Dar es Salaam']?.code || 'WH-DAR-ES-SALAAM-01',
      lat: -6.8161,
      lng: 39.2803,
      regionName: 'Dar es Salaam'
    };
  };

  // Historical quote fetch: strictly within 1km radius
  const fetchQuotes = async (city: string, coordsParam?: { lat: number; lng: number } | null) => {
    const dest = resolveDestinationWarehouse(city, coordsParam || deliveryCoords);
    const coords = coordsParam || deliveryCoords || dest;
    const sellerLat = sellerCoords?.lat ?? -6.8161;
    const sellerLng = sellerCoords?.lng ?? 39.2803;
    const originWarehouseCode = ((): string => {
      if (sellerCoords?.region) {
        const matchingCity = Object.keys(citiesCoords).find(k => k.toLowerCase() === sellerCoords.region!.toLowerCase());
        if (matchingCity) return citiesCoords[matchingCity].code;
      }
      let nearestCode = 'WH-DAR-ES-SALAAM-01';
      let minDistance = Infinity;
      const listToUse = Object.keys(citiesCoords).length > 0 ? Object.values(citiesCoords).map(c => ({ code: c.code, latitude: c.lat, longitude: c.lng })) : [
        { code: 'WH-DAR-ES-SALAAM-01', latitude: -6.8161, longitude: 39.2803 },
        { code: 'WH-MWANZA-01', latitude: -2.5167, longitude: 32.9000 }
      ];
      for (const w of listToUse) {
        const wLat = Number(w.latitude);
        const wLng = Number(w.longitude);
        const d = Math.sqrt(Math.pow(wLat - sellerLat, 2) + Math.pow(wLng - sellerLng, 2));
        if (d < minDistance) {
          minDistance = d;
          nearestCode = w.code;
        }
      }
      return nearestCode;
    })();

    try {
      const res = await api.post('/api/logistics/pricing/quote/', {
        start_lat: sellerLat,
        start_lng: sellerLng,
        end_lat: coords?.lat,
        end_lng: coords?.lng,
        fulfillment_type: fulfillmentType,
        origin_code: originWarehouseCode,
        destination_code: dest.code,
        speed_code: deliverySpeed,
      });
      setHasHistoricalPrice(Boolean(res.data.has_historical_price));
      setHistoricalPrice(res.data.price ? Number(res.data.price) : null);
    } catch (err) {
      console.error('Failed to load delivery pricing quote', err);
      setHasHistoricalPrice(false);
      setHistoricalPrice(null);
    }
  };

  const fetchCheckoutOptions = async (city: string, abortSignal?: AbortSignal) => {
    const dest = resolveDestinationWarehouse(city, deliveryCoords);
    const sellerLat = sellerCoords?.lat ?? -6.8161;
    const sellerLng = sellerCoords?.lng ?? 39.2803;
    const originWarehouseCode = ((): string => {
      if (sellerCoords?.region) {
        const matchingCity = Object.keys(citiesCoords).find(k => k.toLowerCase() === sellerCoords.region!.toLowerCase());
        if (matchingCity) return citiesCoords[matchingCity].code;
      }
      let nearestCode = 'WH-DAR-ES-SALAAM-01';
      let minDistance = Infinity;
      const listToUse = Object.keys(citiesCoords).length > 0 ? Object.values(citiesCoords).map(c => ({ code: c.code, latitude: c.lat, longitude: c.lng })) : [
        { code: 'WH-DAR-ES-SALAAM-01', latitude: -6.8161, longitude: 39.2803 },
        { code: 'WH-MWANZA-01', latitude: -2.5167, longitude: 32.9000 }
      ];
      for (const w of listToUse) {
        const wLat = Number(w.latitude);
        const wLng = Number(w.longitude);
        const d = Math.sqrt(Math.pow(wLat - sellerLat, 2) + Math.pow(wLng - sellerLng, 2));
        if (d < minDistance) { minDistance = d; nearestCode = w.code; }
      }
      return nearestCode;
    })();
    // Only show skeleton on cold start before options are first retrieved
    if (fulfillmentOptions.length === 0) {
      setLoadingOptions(true);
    }
    try {
      const res = await api.post('/api/logistics/checkout-options/', {
        origin_code: originWarehouseCode,
        destination_code: dest.code,
      });
      if (abortSignal?.aborted) return;
      const opts = res.data.options || [];
      if (opts.length > 0) {
        setFulfillmentOptions(opts);
        const currentIsValid = opts.some((o: any) => o.fulfillment_type === fulfillmentType);
        if (!currentIsValid) {
          const matchMethod = opts.find((o: any) => o.shipping_method === shippingMethod) || opts[0];
          setFulfillmentType(matchMethod.fulfillment_type);
          setShippingMethod(matchMethod.shipping_method);
        }
      } else {
        setFulfillmentOptions(DEFAULT_FULFILLMENT_OPTIONS);
      }
    } catch (err) {
      if (abortSignal?.aborted) return;
      console.error('Failed to load fulfillment options', err);
      setFulfillmentOptions(DEFAULT_FULFILLMENT_OPTIONS);
    } finally {
      setLoadingOptions(false);
    }
  };

  // 1. Fetch available fulfillment catalog only when route or warehouses list change
  useEffect(() => {
    if (checkoutItems.length === 0) return;
    const controller = new AbortController();
    fetchCheckoutOptions(selectedCity, controller.signal);
    return () => controller.abort();
  }, [selectedCity, checkoutItems.length, sellerCoords?.lat, sellerCoords?.lng, citiesCoords, warehouses]);

  // 2. Fetch pricing quote independently when platform delivery is active
  useEffect(() => {
    if (checkoutItems.length === 0) return;
    if (shippingMethod === 'DELIVERY' && fulfillmentType === 'PLATFORM_DELIVERY') {
      fetchQuotes(selectedCity);
    } else {
      setHasHistoricalPrice(false);
      setHistoricalPrice(null);
    }
  }, [selectedCity, deliveryCoords?.lat, deliveryCoords?.lng, shippingMethod, fulfillmentType, deliverySpeed, sellerCoords?.lat, sellerCoords?.lng, citiesCoords]);

  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setValidatingPromo(true);
    try {
      const res = await api.post('/api/promo-codes/validate/', {
        code: promoCode.trim().toUpperCase(),
        merchant: merchant,
        subtotal: checkoutTotal
      });
      setAppliedPromo(res.data);
      toast.success(t('promo_applied', 'Promo code applied successfully!'));
    } catch (err: any) {
      setAppliedPromo(null);
      toast.error(err.response?.data?.error || err.response?.data?.detail || t('promo_invalid', 'Invalid promo code'));
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
  };

  const discountAmount = appliedPromo ? Number(appliedPromo.discount_amount) : 0;
  const finalTotal = Math.max(0, checkoutTotal - discountAmount);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  useEffect(() => {
    if (checkoutItems.length === 0 && !checkoutSuccess) {
      navigate('/cart', { replace: true });
    }
  }, [checkoutItems.length, navigate, checkoutSuccess]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const formatDisplayAddress = (addr?: string | null, city?: string, district?: string) => {
    const clean = (addr || '').trim();
    if (!clean || /^-?\d+\.\d+,\s*-?\d+\.\d+/.test(clean) || /^GPS:/i.test(clean)) {
      if (district && city) return `${district}, ${city}`;
      if (district) return district;
      if (city) return city;
      return 'Current Location';
    }
    if (city && !clean.toLowerCase().includes(city.toLowerCase())) {
      return `${clean}, ${city}`;
    }
    return clean;
  };

  const handleLocationPicked = (
    address: string,
    coords?: { lat: number; lng: number },
    regionName?: string,
    districtName?: string,
    countryCode?: string
  ) => {
    let cleanAddress = (address || '').trim();
    if (!cleanAddress || /^-?\d+\.\d+,\s*-?\d+\.\d+/.test(cleanAddress) || /^GPS:/i.test(cleanAddress)) {
      cleanAddress = districtName || regionName || selectedCity || 'Current Location';
    }
    setForm(prev => ({ ...prev, deliveryAddress: cleanAddress }));
    if (coords) {
      setDeliveryCoords(coords);
    }

    // Auto-detect country from countryCode or address string
    let detected: CountryInfo | undefined;
    if (countryCode) {
      detected = SUPPORTED_COUNTRIES.find(c => c.code.toUpperCase() === countryCode.toUpperCase());
    }
    if (!detected) {
      detected = detectCountryFromAddress(cleanAddress, selectedCountry.code);
    }
    if (detected) {
      setSelectedCountry(detected);
      if (localPhone) {
        const clampedDigits = localPhone.trim().replace(/^0+/, '').slice(0, detected.digitCount);
        setLocalPhone(clampedDigits);
        setForm(prev => ({
          ...prev,
          phone: `${detected!.dialCode}${clampedDigits}`
        }));
      }
    }

    // Collapse search to reduce clutter once location is selected
    setIsSearchingLocation(false);

    let targetCity = selectedCity;

    if (regionName) {
      const cleanRegion = regionName.replace(/\s+Region$/i, '').trim();
      const match = regionsData.find((r: any) =>
        r.name.toLowerCase() === cleanRegion.toLowerCase() ||
        cleanRegion.toLowerCase().includes(r.name.toLowerCase()) ||
        r.name.toLowerCase().includes(cleanRegion.toLowerCase())
      );
      const matchedCity = match ? match.name : cleanRegion;
      targetCity = matchedCity;
      setSelectedCity(matchedCity);

      if (districtName && match?.districts) {
        const cleanDistrict = districtName.replace(/\s+District$/i, '').trim();
        const distMatch = match.districts.find((d: any) =>
          d.name.toLowerCase() === cleanDistrict.toLowerCase() ||
          cleanDistrict.toLowerCase().includes(d.name.toLowerCase()) ||
          d.name.toLowerCase().includes(cleanDistrict.toLowerCase())
        );
        setSelectedDistrict(distMatch ? distMatch.name : (match.districts[0]?.name || cleanDistrict));
      } else if (match?.districts?.length > 0) {
        setSelectedDistrict(match.districts[0].name);
      }
    } else {
      const cleanLower = cleanAddress.toLowerCase();
      const match = regionsData.find((r: any) =>
        cleanLower.includes(r.name.toLowerCase())
      );
      if (match) {
        targetCity = match.name;
        setSelectedCity(match.name);
      }
    }

    fetchCheckoutOptions(targetCity);
    if (coords) {
      fetchQuotes(targetCity, coords);
    }
  };

  // Auto-detect user's location on initial load if delivery address is not set yet
  useEffect(() => {
    if (checkoutItems.length === 0) return;
    if (!form.deliveryAddress && (!savedAddresses || savedAddresses.length === 0)) {
      const isRaw = (str?: string | null) => !str || /^-?\d+\.\d+,\s*-?\d+\.\d+/.test(str.trim()) || /^GPS:/i.test(str.trim());

      if (userLoc.address && !isRaw(userLoc.address)) {
        handleLocationPicked(
          userLoc.address,
          userLoc.coords || undefined,
          userLoc.region || userLoc.city || undefined,
          userLoc.district || undefined
        );
      } else {
        ensureLocation().then(coords => {
          if (coords) {
            axios.get('https://nominatim.openstreetmap.org/reverse', {
              params: { lat: coords.lat, lon: coords.lng, format: 'json', addressdetails: 1 }
            }).then(res => {
              const data = res.data;
              if (data && data.display_name) {
                const parts = data.display_name.split(',').map((s: string) => s.trim());
                const clean = parts.slice(0, 3).join(', ');
                const cCode = data.address?.country_code?.toUpperCase();
                handleLocationPicked(
                  clean,
                  coords,
                  data.address?.state || data.address?.city,
                  data.address?.county || data.address?.district,
                  cCode
                );
              } else {
                handleLocationPicked(
                  userLoc.district || userLoc.city || 'Dar es Salaam',
                  coords,
                  userLoc.region || userLoc.city || 'Dar es Salaam',
                  userLoc.district || undefined,
                  'TZ'
                );
              }
            }).catch(err => {
              console.warn('Reverse geocode error on mount', err);
              if (coords) {
                handleLocationPicked(
                  userLoc.district || userLoc.city || 'Dar es Salaam',
                  coords,
                  userLoc.region || userLoc.city || 'Dar es Salaam',
                  userLoc.district || undefined,
                  'TZ'
                );
              }
            });
          }
        }).catch(err => {
          console.warn('Geolocation silent fallback', err);
        });
      }
    }
  }, [userLoc.address, checkoutItems.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const activeDial = selectedCountry.dialCode;
    const expectedDigits = selectedCountry.digitCount || 9;
    const cleanDigits = localPhone.trim().replace(/\D/g, '').replace(/^0+/, '');

    if (shippingMethod === 'DELIVERY' && (!form.fullName || !cleanDigits || !form.deliveryAddress)) {
      toast.error(t('fill_required_fields_error', 'Please provide recipient name, phone, and delivery address.'));
      return;
    }

    if (shippingMethod === 'PICKUP' && (!form.fullName || !cleanDigits)) {
      toast.error(t('fill_required_fields_error', 'Please provide your name and phone number for pickup.'));
      return;
    }

    if (cleanDigits.length !== expectedDigits) {
      toast.error(
        t(
          'phone_digit_count_error',
          `Phone number must be exactly ${expectedDigits} digits for ${selectedCountry.name} (after ${selectedCountry.dialCode}).`
        )
      );
      return;
    }

    const finalPhone = `${activeDial}${cleanDigits}`;

    if (hasQuoteItem) {
      setSubmitting(true);
      try {
        const rfqData = {
          items: checkoutItems.map((i: any) => {
            let pId = i.productId;
            if (typeof pId === 'string' && pId.includes('-')) pId = parseInt(pId.split('-')[0], 10);
            return { product_id: pId, quantity: i.quantity };
          }),
          shipping_method: shippingMethod,
          fulfillment_type: fulfillmentType,
          delivery_speed: deliverySpeed
        };
        const res = await api.post('/api/orders/request-invoice/', rfqData);
        setCheckoutSuccess(true);
        clearCartByMerchant(merchant);
        toast.success(t('quote_requested_success', 'Quote requested successfully!'));
        setTimeout(() => navigate(`/orders?highlight=${res.data.order_id}`), 100);
      } catch (error: any) {
        toast.error(error.response?.data?.error || t('request_failed', 'Failed to request quote.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Persist address to saved list if requested or editing
    if (shouldSaveAddress && form.fullName && finalPhone && (shippingMethod === 'PICKUP' || form.deliveryAddress)) {
      const username = localStorage.getItem('username') || undefined;
      const saved = saveAddress({
        id: isEditingAddress && selectedSavedAddressId ? selectedSavedAddressId : undefined,
        fullName: form.fullName,
        phone: finalPhone,
        countryCode: selectedCountry.code,
        dialCode: selectedCountry.dialCode,
        deliveryAddress: form.deliveryAddress,
        city: selectedCity,
        district: selectedDistrict,
        coords: deliveryCoords || undefined,
        notes: form.notes,
        isDefault: savedAddresses.length === 0,
      }, username);
      setSavedAddresses(getSavedAddresses(username));
      setSelectedSavedAddressId(saved.id);
      setIsEditingAddress(false);
    }

    setSubmitting(true);
    try {
      const nearestWarehouseCode = (() => {
        if (sellerCoords?.region) {
          const matchingCity = Object.keys(citiesCoords).find(k => k.toLowerCase() === sellerCoords.region!.toLowerCase());
          if (matchingCity) return citiesCoords[matchingCity].code;
        }
        return citiesCoords[selectedCity]?.code || 'WH-DAR-ES-SALAAM-01';
      })();

      const destWh = resolveDestinationWarehouse(selectedCity, deliveryCoords);

      const roundedLat = deliveryCoords?.lat != null ? Number(Number(deliveryCoords.lat).toFixed(6)) : null;
      const roundedLng = deliveryCoords?.lng != null ? Number(Number(deliveryCoords.lng).toFixed(6)) : null;

      const deliveryPayload = {
        full_name: form.fullName,
        phone: finalPhone,
        address: form.deliveryAddress,
        notes: form.notes,
        city: selectedCity,
        region: selectedCity,
        district: selectedDistrict,
        destination_warehouse_code: destWh.code || nearestWarehouseCode,
        origin_warehouse_code: nearestWarehouseCode,
        delivery_speed: deliverySpeed,
        lat: roundedLat,
        lng: roundedLng,
      };

      if (invoiceOrder) {
        await api.post(`/api/orders/${invoiceOrder.id}/advance/`, {
          status: 'AWAITING_PAYMENT',
          delivery_info: deliveryPayload,
          notes: 'Customer submitted delivery details.',
          delivery_latitude: roundedLat,
          delivery_longitude: roundedLng,
        });

        setCheckoutSuccess(true);
        clearCartByMerchant(merchant);
        toast.success(t('order_placed_success', 'Order placed successfully!'));
        setTimeout(() => {
          navigate(`/orders?highlight=${invoiceOrder.id}`);
        }, 100);
        return;
      }

      const orderData = {
        items: checkoutItems.map((item: any) => {
          let productId = item.productId;
          let variantId = null;
          if (typeof productId === 'string' && productId.includes('-')) {
            const parts = productId.split('-');
            productId = parseInt(parts[0], 10);
            variantId = parseInt(parts[1], 10);
          }
          return {
            product: productId,
            variant: variantId,
            quantity: item.quantity,
          };
        }),
        total_amount: finalTotal,
        shipping_method: shippingMethod,
        fulfillment_type: fulfillmentType,
        delivery_speed: deliverySpeed,
        shipping_fee: 0, 
        promo_code: appliedPromo ? appliedPromo.code : undefined,
        delivery_info: deliveryPayload,
        delivery_latitude: roundedLat,
        delivery_longitude: roundedLng,
      };

      const res = await api.post('/api/orders/', orderData);
      const orderId = res.data.id;

      await api.post(`/api/orders/${orderId}/advance/`, { 
        status: 'AWAITING_PAYMENT',
        notes: 'Order placed, awaiting offline payment proof.' 
      });

      setCheckoutSuccess(true);
      clearCartByMerchant(merchant);
      toast.success(t('order_placed_success', 'Order placed successfully!'));
      setTimeout(() => {
        navigate(`/orders?highlight=${orderId}`);
      }, 100);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || error.response?.data?.error || t('order_placed_failed', 'Failed to place order'));
    } finally {
      setSubmitting(false);
    }
  };

  if (checkoutItems.length === 0) {
    return null;
  }

  return (
    <div className="container-page max-w-5xl py-4 sm:py-8 px-4 sm:px-6">
      {/* Checkout Title */}
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {t('checkout', 'Checkout')}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {t('seller', 'Seller')}: <span className="font-semibold text-neutral-900 dark:text-neutral-200">@{merchant}</span>
          </p>
        </div>
        {(invoiceOrder || invoiceOrder?.is_bulk_order) && (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
            {t('bulk_order', 'Bulk Order')}
          </span>
        )}
      </div>

      {/* Mobile Collapsible Order Summary Accordion (hidden on lg) */}
      <div className="lg:hidden mb-6 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-950">
        <button
          type="button"
          onClick={() => setShowMobileSummary(prev => !prev)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-900 dark:text-white">
            <ShoppingCart size={15} className="text-neutral-500" />
            <span>{showMobileSummary ? t('hide_order_summary', 'Hide order summary') : t('show_order_summary', 'Show order summary')}</span>
            {showMobileSummary ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
          </div>
          <span className="text-sm font-bold text-neutral-900 dark:text-white">
            TSh {finalTotal.toLocaleString()}
          </span>
        </button>

        {showMobileSummary && (
          <div className="p-4 pt-0 border-t border-neutral-100 dark:border-neutral-900 space-y-3">
            <div className="space-y-2.5 max-h-56 overflow-y-auto pt-3">
              {checkoutItems.map((item: any) => (
                <div key={item.productId} className="flex items-center gap-3">
                  <SafeImage
                    src={item.image}
                    alt={item.name}
                    category={item.category}
                    className="w-10 h-10 object-cover rounded-md bg-neutral-100 dark:bg-neutral-900 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-neutral-900 dark:text-white truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <p className="text-xs font-bold text-neutral-900 dark:text-white shrink-0">
                    TSh {(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Mobile Promo Code */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-900 space-y-2">
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                {t('promo_code', 'Promo Code')}
              </label>
              {appliedPromo ? (
                <div className="flex justify-between items-center p-2 rounded-lg bg-neutral-100 dark:bg-neutral-900">
                  <div>
                    <span className="font-mono font-bold text-xs text-neutral-900 dark:text-white">
                      {appliedPromo.code}
                    </span>
                    <span className="text-[10px] text-neutral-500 block">Applied</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition"
                  >
                    {t('remove', 'Remove')}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. SAVE10"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="flex-1 h-9 px-3 rounded-lg border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 font-mono outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    disabled={validatingPromo || !promoCode.trim()}
                    className="px-3 h-9 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-900 dark:text-white disabled:opacity-40 transition-colors"
                  >
                    {validatingPromo ? '...' : t('apply_btn', 'Apply')}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Breakdown */}
            <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-900 text-xs">
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>{t('subtotal', 'Items Subtotal')}</span>
                <span className="font-semibold text-neutral-900 dark:text-white">TSh {checkoutTotal.toLocaleString()}</span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between text-neutral-700 dark:text-neutral-300">
                  <span>Discount ({appliedPromo.code})</span>
                  <span className="font-medium">- TSh {Number(appliedPromo.discount_amount || 0).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>{t('shipping', 'Delivery Fee')}</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-200">
                  {shippingMethod === 'PICKUP'
                    ? t('free', 'Free')
                    : fulfillmentType === 'DIRECT_DELIVERY'
                    ? t('arranged_with_seller', 'Arranged with seller')
                    : (hasHistoricalPrice && historicalPrice)
                    ? `Est. ~TSh ${historicalPrice.toLocaleString()}`
                    : t('calculated_at_warehouse', 'Calculated at warehouse')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Main Flow Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-8">
          
          {/* SECTION 1: Delivery Address & Contact Details (Zero nested card boxes) */}
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white">
                1. {t('delivery_destination', 'Delivery Destination & Contact')}
              </h2>
              {/* Minimal segmented toggle: full width on mobile for easy thumb tapping */}
              <div className="grid grid-cols-2 sm:inline-flex rounded-lg bg-neutral-100 dark:bg-neutral-900 p-0.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setShippingMethod('DELIVERY');
                    const deliveryOpt = fulfillmentOptions.find(o => o.shipping_method === 'DELIVERY');
                    if (deliveryOpt) setFulfillmentType(deliveryOpt.fulfillment_type);
                  }}
                  className={`py-2 sm:py-1.5 px-3 text-xs font-medium rounded-md transition-all text-center ${
                    shippingMethod === 'DELIVERY'
                      ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {t('delivery', 'Delivery')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShippingMethod('PICKUP');
                    const pickupOpt = fulfillmentOptions.find(o => o.shipping_method === 'PICKUP');
                    if (pickupOpt) setFulfillmentType(pickupOpt.fulfillment_type);
                  }}
                  className={`py-2 sm:py-1.5 px-3 text-xs font-medium rounded-md transition-all text-center ${
                    shippingMethod === 'PICKUP'
                      ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {t('pickup', 'Self-Pickup')}
                </button>
              </div>
            </div>

            {/* SAVED ADDRESS PREVIEW CARD (Shown when user has saved address and not in new/edit mode) */}
            {savedAddresses.length > 0 && !isEnteringNewAddress && !isEditingAddress ? (
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {form.fullName || 'Recipient'}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-neutral-200/80 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-mono">
                        <span>{selectedCountry.flag}</span>
                        <span>{form.phone}</span>
                      </span>
                    </div>

                    {shippingMethod === 'DELIVERY' && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5 pt-0.5">
                        <MapPin size={14} className="shrink-0 mt-0.5 text-neutral-400" />
                        <span>
                          {formatDisplayAddress(form.deliveryAddress, selectedCity, selectedDistrict)}
                        </span>
                      </p>
                    )}

                    {form.notes && (
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-500 italic pl-5">
                        Note: {form.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions: Change / Edit / New */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {savedAddresses.length > 1 && (
                      <div className="relative" ref={addressDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setShowAddressDropdown(!showAddressDropdown)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition"
                        >
                          {t('change', 'Change')}
                        </button>
                        {showAddressDropdown && (
                          <div className="absolute right-0 top-full mt-1.5 w-72 max-h-64 overflow-y-auto bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-50 py-1 divide-y divide-neutral-100 dark:divide-neutral-900">
                            {savedAddresses.map((addr) => (
                              <div
                                key={addr.id}
                                onClick={() => {
                                  setSelectedSavedAddressId(addr.id);
                                  applySavedAddress(addr);
                                  setShowAddressDropdown(false);
                                }}
                                className={`p-3 text-left cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition ${
                                  selectedSavedAddressId === addr.id ? 'bg-neutral-100 dark:bg-neutral-900 font-medium' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                                    {addr.fullName}
                                  </span>
                                  {selectedSavedAddressId === addr.id && (
                                    <Check size={14} className="text-neutral-900 dark:text-white" />
                                  )}
                                </div>
                                <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                                  {formatDisplayAddress(addr.deliveryAddress, addr.city, addr.district)}
                                </div>
                                <div className="text-[11px] font-mono text-neutral-400 mt-0.5">
                                  {addr.dialCode} {addr.phone}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(true)}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                      title={t('edit_address', 'Edit Address')}
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsEnteringNewAddress(true);
                        setIsEditingAddress(false);
                        setLocalPhone('');
                        setForm(prev => ({
                          ...prev,
                          fullName: '',
                          phone: '',
                          deliveryAddress: '',
                          notes: ''
                        }));
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition"
                    >
                      <Plus size={13} />
                      <span>{t('new', 'New')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* INPUT FORM (When entering new address, editing, or no saved address exists) */
              <div className="space-y-4">
                {/* Back to saved address banner if user was adding new address */}
                {savedAddresses.length > 0 && isEnteringNewAddress && (
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-medium text-neutral-500">
                      {t('enter_new_delivery_info', 'Enter new delivery information')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEnteringNewAddress(false);
                        const cur = savedAddresses.find(a => a.id === selectedSavedAddressId) || savedAddresses[0];
                        applySavedAddress(cur);
                      }}
                      className="text-xs text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 font-medium transition"
                    >
                      <ArrowLeft size={13} />
                      <span>{t('use_saved_address', 'Use saved address')}</span>
                    </button>
                  </div>
                )}

                {/* 1. Location (First element in delivery form) */}
                {shippingMethod === 'DELIVERY' && (
                  <div>
                    {!isSearchingLocation && form.deliveryAddress ? (
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin size={15} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">{t('delivering_to', 'Delivering to')}:</span>
                          <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                            {formatDisplayAddress(form.deliveryAddress, selectedCity, selectedDistrict)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsSearchingLocation(true)}
                          className="text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white underline ml-3 shrink-0"
                        >
                          {t('change', 'Change')}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                            {t('delivery_location', 'Specific Delivery Location')} *
                          </label>
                          <div className="flex items-center gap-2.5">
                            {form.deliveryAddress.trim() && (
                              <button
                                type="button"
                                onClick={() => handleLocationPicked(form.deliveryAddress)}
                                className="text-xs font-semibold text-neutral-900 dark:text-white hover:underline"
                              >
                                {t('confirm', 'Confirm')}
                              </button>
                            )}
                            {form.deliveryAddress && (
                              <button
                                type="button"
                                onClick={() => setIsSearchingLocation(false)}
                                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 underline"
                              >
                                {t('cancel', 'Cancel')}
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <AddressAutocomplete
                          value={form.deliveryAddress}
                          onChange={(val) => {
                            setForm(prev => ({ ...prev, deliveryAddress: val }));
                          }}
                          onSelect={(address, coords, regionName, districtName, countryCode) => {
                            handleLocationPicked(address, coords, regionName, districtName, countryCode);
                          }}
                          autoFocus
                          placeholder={t('address_placeholder', 'Type specific location, street, or landmark...')}
                        />

                        {/* Clean Location Tag */}
                        {selectedCity && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                            <span>Delivering to:</span>
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                              {selectedCity}{selectedDistrict ? `, ${selectedDistrict}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Recipient Contact Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                      {t('full_name', 'Full Name')} *
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      required
                      value={form.fullName}
                      onChange={handleChange}
                      placeholder="e.g. Maria Mwangi"
                      className="w-full h-11 px-3.5 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-600 dark:focus:border-neutral-300 transition-colors"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        {t('phone_number', 'Phone Number')} *
                      </label>
                      {localPhone.length > 0 && (
                        <span className={`text-[11px] font-mono transition-colors ${
                          localPhone.length === (selectedCountry.digitCount || 9)
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'text-neutral-400 dark:text-neutral-500'
                        }`}>
                          {localPhone.length}/{selectedCountry.digitCount || 9}
                        </span>
                      )}
                    </div>
                    <div
                      onClick={() => phoneInputRef.current?.focus()}
                      className="flex items-center h-11 px-3.5 rounded-lg border border-neutral-300 bg-white dark:border-neutral-800 dark:bg-neutral-950 focus-within:border-neutral-950 dark:focus-within:border-neutral-300 transition-colors cursor-text"
                    >
                      <span className="text-sm font-mono text-neutral-500 dark:text-neutral-400 select-none mr-2 shrink-0">
                        {selectedCountry.dialCode}
                      </span>
                      <input
                        ref={phoneInputRef}
                        type="tel"
                        name="phone"
                        id="phone"
                        value={localPhone}
                        onChange={handleLocalPhoneChange}
                        placeholder={selectedCountry.placeholder}
                        maxLength={selectedCountry.digitCount || 9}
                        required
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        data-lpignore="true"
                        data-form-type="other"
                        className="w-full h-full bg-transparent text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 outline-none focus:outline-none focus-visible:outline-none border-0 border-none ring-0 focus:ring-0 focus-visible:ring-0 shadow-none focus:shadow-none font-mono p-0"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Delivery Landmarks / Notes */}
                {shippingMethod === 'DELIVERY' && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                      {t('delivery_notes', 'Delivery Landmarks / Notes (Optional)')}
                    </label>
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      rows={2}
                      placeholder={t('delivery_notes_placeholder', 'e.g. Blue gate, near landmark')}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-600 dark:focus:border-neutral-300 resize-none transition-colors"
                    />
                  </div>
                )}

                {/* Save address checkbox (only shown when creating/entering a new address) */}
                {!isEditingAddress && (
                  <label className="flex items-center gap-2 cursor-pointer pt-1 group select-none">
                    <input
                      type="checkbox"
                      checked={shouldSaveAddress}
                      onChange={(e) => setShouldSaveAddress(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-neutral-950 dark:text-white focus:ring-0 cursor-pointer accent-neutral-950 dark:accent-white"
                    />
                    <span className="text-xs text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                      {t('save_address_for_future', 'Save this delivery information for future orders')}
                    </span>
                  </label>
                )}

                {/* Actions row when actively editing an existing address */}
                {isEditingAddress && (
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveEditedAddress}
                      className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition"
                    >
                      {t('save_changes', 'Save Changes')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingAddress(false);
                        const cur = savedAddresses.find(a => a.id === selectedSavedAddressId) || savedAddresses[0];
                        applySavedAddress(cur);
                      }}
                      className="px-3.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                    >
                      {t('cancel', 'Cancel')}
                    </button>
                    {selectedSavedAddressId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedAddress(selectedSavedAddressId)}
                        className="ml-auto text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition"
                      >
                        <Trash2 size={13} />
                        <span>{t('delete', 'Delete')}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {shippingMethod === 'PICKUP' && (
              <div className="pt-2 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
                <p>
                  You have selected self-pickup. Your order will be held for collection once processed.
                </p>
                <p className="text-neutral-500">
                  A collection code will be generated upon arrival at the pickup point.
                </p>
              </div>
            )}
          </div>

          {/* SECTION 2: Fulfillment & Shipping Method */}
          <div className="space-y-4">
            <h2 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white">
              2. {t('fulfillment_method', 'Fulfillment Method')}
            </h2>

            {loadingOptions && fulfillmentOptions.length === 0 ? (
              <div className="h-20 rounded-xl bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
            ) : (() => {
              const availableOptions = fulfillmentOptions.filter(opt => opt.shipping_method === shippingMethod);
              if (fulfillmentOptions.length === 0) {
                return (
                  <p className="text-sm text-neutral-500 py-4 text-center">
                    Please enter your delivery destination above to see available fulfillment methods.
                  </p>
                );
              }
              if (availableOptions.length === 0) {
                return (
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-center">
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {shippingMethod === 'PICKUP'
                        ? 'No pickup locations available for this route. Switch to Delivery to have it shipped to your address.'
                        : 'No direct delivery options available for this selection.'}
                    </p>
                    {shippingMethod === 'PICKUP' && (
                      <button
                        type="button"
                        onClick={() => setShippingMethod('DELIVERY')}
                        className="mt-2 text-xs font-semibold text-neutral-900 dark:text-white underline cursor-pointer"
                      >
                        Switch to Delivery
                      </button>
                    )}
                  </div>
                );
              }
              return (
                /* Single crisp divided stack: ZERO boundaries within boundaries */
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800 overflow-hidden bg-white dark:bg-neutral-950">
                  {availableOptions.map(opt => {
                    const isSelected = fulfillmentType === opt.fulfillment_type;
                    return (
                      <div
                        key={opt.fulfillment_type}
                        onClick={() => {
                          setFulfillmentType(opt.fulfillment_type);
                          setShippingMethod(opt.shipping_method);
                        }}
                        className={`p-4 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-neutral-50 dark:bg-neutral-900'
                            : 'hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="fulfillment_selection"
                              checked={isSelected}
                              onChange={() => {
                                setFulfillmentType(opt.fulfillment_type);
                                setShippingMethod(opt.shipping_method);
                              }}
                              className="mt-1 w-4 h-4 accent-neutral-950 dark:accent-white cursor-pointer shrink-0"
                            />
                            <div>
                              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                                {opt.name}
                              </p>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                                {opt.description}
                              </p>
                            </div>
                          </div>

                          <div className="pl-7 sm:pl-0 sm:text-right shrink-0">
                            {opt.fulfillment_type === 'PLATFORM_DELIVERY' ? (
                              hasHistoricalPrice && historicalPrice ? (
                                <div>
                                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                                    ~TSh {historicalPrice.toLocaleString()}
                                  </span>
                                  <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                                    Est. based on area
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                                    Calculated at warehouse
                                  </span>
                                  <span className="block text-[11px] text-neutral-400">
                                    Billed after intake
                                  </span>
                                </div>
                              )
                            ) : opt.fulfillment_type === 'DIRECT_DELIVERY' ? (
                              <div>
                                <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                                  Arranged with seller
                                </span>
                                <span className="block text-[11px] text-neutral-400">
                                  No platform fee
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                                Free
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Delivery Speed Dropdown for Platform Warehouse fulfillment */}
            {shippingMethod === 'DELIVERY' && fulfillmentType === 'PLATFORM_DELIVERY' && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  {t('delivery_speed', 'Delivery Speed')}
                </label>
                <select
                  value={deliverySpeed}
                  onChange={(e) => setDeliverySpeed(e.target.value as any)}
                  className="w-full h-11 px-3.5 rounded-lg border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm text-neutral-900 dark:text-white outline-none focus:border-neutral-950 dark:focus:border-neutral-300 transition-colors cursor-pointer"
                >
                  <option value="standard">{t('speed_standard', 'Standard Delivery (2–3 business days)')}</option>
                  <option value="express">{t('speed_express', 'Express Delivery (1–2 business days)')}</option>
                  <option value="economy">{t('speed_economy', 'Economy Delivery (3–5 business days)')}</option>
                </select>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  {t('speed_note', 'Determines transit priority and delivery fee when processed at the warehouse hub.')}
                </p>
              </div>
            )}
          </div>

          {/* Checkout Action Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl font-semibold text-sm transition-all bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : hasQuoteItem ? (
              t('request_invoice', 'Request Invoice')
            ) : (
              t('pay_product_price', {
                price: finalTotal.toLocaleString(),
                defaultValue: `Pay Product Price — TSh ${finalTotal.toLocaleString()}`
              })
            )}
          </button>
        </form>

        {/* SECTION 3: Order Summary Sidebar (Desktop sticky, clean boundaries) */}
        <div className="hidden lg:block lg:col-span-5 w-full">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 sticky top-24 space-y-5">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              {t('order_summary', 'Order Summary')}
            </h2>

            {/* Items List */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {checkoutItems.map((item: any) => (
                <div key={item.productId} className="flex items-center gap-3">
                  <SafeImage
                    src={item.image}
                    alt={item.name}
                    category={item.category}
                    className="w-12 h-12 object-cover rounded-lg bg-neutral-100 dark:bg-neutral-900 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <p className="text-xs font-bold text-neutral-900 dark:text-white shrink-0">
                    TSh {(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Promo Code Input (No double border lines) */}
            <div className="pt-2 space-y-2">
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                {t('promo_code', 'Promo Code')}
              </label>
              {appliedPromo ? (
                <div className="flex justify-between items-center p-2 rounded-lg bg-neutral-100 dark:bg-neutral-900">
                  <div>
                    <span className="font-mono font-bold text-xs text-neutral-900 dark:text-white">
                      {appliedPromo.code}
                    </span>
                    <span className="text-[10px] text-neutral-500 block">Applied</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition"
                  >
                    {t('remove', 'Remove')}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. SAVE10"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="flex-1 h-9 px-3 rounded-lg border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 font-mono outline-none focus:border-neutral-950 dark:focus:border-neutral-300"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    disabled={validatingPromo || !promoCode.trim()}
                    className="px-3 h-9 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-900 dark:text-white disabled:opacity-40 transition-colors"
                  >
                    {validatingPromo ? '...' : t('apply_btn', 'Apply')}
                  </button>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-2.5 text-xs pt-2">
              <div className="flex justify-between items-center text-neutral-600 dark:text-neutral-400">
                <span>{t('subtotal', 'Items Subtotal')}</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  TSh {checkoutTotal.toLocaleString()}
                </span>
              </div>

              {appliedPromo && (
                <div className="flex justify-between items-center text-neutral-700 dark:text-neutral-300">
                  <span>Discount ({appliedPromo.code})</span>
                  <span className="font-medium">
                    - TSh {Number(appliedPromo.discount_amount || 0).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-neutral-600 dark:text-neutral-400">
                <span>{t('shipping', 'Delivery Fee')}</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-200">
                  {shippingMethod === 'PICKUP'
                    ? t('free', 'Free')
                    : fulfillmentType === 'DIRECT_DELIVERY'
                    ? t('arranged_with_seller', 'Arranged with seller')
                    : (hasHistoricalPrice && historicalPrice)
                    ? `Est. ~TSh ${historicalPrice.toLocaleString()}`
                    : t('calculated_at_warehouse', 'Calculated at warehouse')}
                </span>
              </div>

              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3 flex justify-between items-baseline">
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {t('due_today', 'Due Today')}
                </span>
                <span className="text-xl font-bold text-neutral-950 dark:text-white">
                  TSh {finalTotal.toLocaleString()}
                </span>
              </div>

              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 leading-normal pt-1">
                * You are paying the product price today. Platform shipping is weighed and confirmed upon parcel arrival at the warehouse.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
