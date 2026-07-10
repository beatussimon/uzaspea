import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation files
const resources = {
  en: {
    translation: {
      "search_placeholder": "Search for products, brands and more...",
      "categories": "Categories",
      "trending": "Trending Now",
      "verified_seller": "Verified Seller",
      "inspected": "Inspected",
      "add_to_cart": "Add to Cart",
      "out_of_stock": "Out of stock",
      "in_stock": "in stock",
      "price": "Price",
      "description": "Description",
      "see_more": "See more",
      "see_less": "See less",
      "checkout": "Checkout",
      "cart": "Your Cart",
      "subtotal": "Subtotal",
      "total": "Total",
      "orders": "My Orders",
      "dashboard": "Dashboard",
      "logout": "Logout",
      "login": "Login",
      "language": "Language",
      "delivery": "Delivery",
      "pickup": "Pickup",
      "select_option": "Select Option",
      "default_option": "Default Option",
      "share": "Share",
      "reviews": "Reviews",
      "no_reviews": "No reviews yet",
      "seller": "Seller",
      "contact_seller": "Contact Seller",
      "product_details": "Product Details",
      "related_products": "Related Products",
      "home": "Home",
      "profile": "Profile",
      "settings": "Settings",
      "notifications": "Notifications",
      "messages": "Messages",
      "help": "Help & Support",
      "sale": "Sale",
      "off": "off",
      "view_cart": "View Cart",
      "empty_cart": "Your cart is empty",
      "remove": "Remove",
      "quantity": "Quantity",
      "place_order": "Place Order",
      "order_summary": "Order Summary",
      "delivery_options": "Delivery Options",
      "payment": "Payment",
      "confirm_order": "Confirm Order",
    }
  },
  sw: {
    translation: {
      "search_placeholder": "Tafuta bidhaa, chapa na mengineyo...",
      "categories": "Kategoria",
      "trending": "Zinazovuma Sasa",
      "verified_seller": "Muuzaji Aliyethibitishwa",
      "inspected": "Imekaguliwa",
      "add_to_cart": "Weka Kwenye Kikapu",
      "out_of_stock": "Imeisha",
      "in_stock": "zipo",
      "price": "Bei",
      "description": "Maelezo",
      "see_more": "Ona zaidi",
      "see_less": "Ona kidogo",
      "checkout": "Nenda Kulipa",
      "cart": "Kikapu Chako",
      "subtotal": "Jumla Ndogo",
      "total": "Jumla",
      "orders": "Oda Zangu",
      "dashboard": "Dashibodi",
      "logout": "Toka Ndani",
      "login": "Ingia",
      "language": "Lugha",
      "delivery": "Kufikishiwa",
      "pickup": "Kuchukua Mwenyewe",
      "select_option": "Chagua Chaguo",
      "default_option": "Chaguo Msingi",
      "share": "Shiriki",
      "reviews": "Maoni",
      "no_reviews": "Hakuna maoni bado",
      "seller": "Muuzaji",
      "contact_seller": "Wasiliana na Muuzaji",
      "product_details": "Maelezo ya Bidhaa",
      "related_products": "Bidhaa Zinazofanana",
      "home": "Nyumbani",
      "profile": "Wasifu",
      "settings": "Mipangilio",
      "notifications": "Arifa",
      "messages": "Ujumbe",
      "help": "Msaada",
      "sale": "Punguzo",
      "off": "punguzo",
      "view_cart": "Angalia Kikapu",
      "empty_cart": "Kikapu chako kiko wazi",
      "remove": "Ondoa",
      "quantity": "Idadi",
      "place_order": "Weka Oda",
      "order_summary": "Muhtasari wa Oda",
      "delivery_options": "Chaguo za Uwasilishaji",
      "payment": "Malipo",
      "confirm_order": "Thibitisha Oda",
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    // Language detection order: localStorage first so user choice persists across reloads,
    // then navigator (browser language), then default 'en'.
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'uzaspea_language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
