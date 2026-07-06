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
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
