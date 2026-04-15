import { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

export interface IconCategory {
  title: string;
  icons: IconName[];
}

export const ICON_PICKER_LIST: IconCategory[] = [
  {
    title: 'الخدمات الرقمية',
    icons: [
      'logo-google', 'logo-youtube', 'logo-apple', 'logo-playstation', 'logo-xbox', 
      'logo-amazon', 'logo-steam', 'logo-rss', 'logo-twitch', 'logo-discord',
      'logo-facebook', 'logo-instagram', 'logo-twitter', 'logo-linkedin',
      'logo-github', 'logo-whatsapp', 'logo-vimeo', 'logo-skype'
    ]
  },
  {
    title: 'المال والتمويل',
    icons: [
      'wallet', 'cash', 'card', 'stats-chart', 'pie-chart', 'trending-up',
      'trending-down', 'shield-half', 'calculator', 'receipt', 'diamond', 'gift',
      'barcode', 'analytics', 'pricetag', 'business'
    ]
  },
  {
    title: 'التسوق والطعام',
    icons: [
      'cart', 'basket', 'bag-handle', 'cafe', 'fast-food', 'restaurant',
      'pizza', 'beer', 'wine', 'ice-cream', 'nutrition', 'storefront'
    ]
  },
  {
    title: 'المنزل والحياة',
    icons: [
      'home', 'car', 'bicycle', 'bus', 'airplane', 'subway', 'bed',
      'tv', 'infinite', 'water', 'flash', 'thermometer', 'snow',
      'leaf', 'flower', 'paw'
    ]
  },
  {
    title: 'الصحة والرياضة',
    icons: [
      'heart', 'medkit', 'bandage', 'fitness', 'football', 'basketball',
      'bicycle', 'walk', 'sunny', 'moon'
    ]
  },
  {
    title: 'العمل والتعليم',
    icons: [
      'briefcase', 'school', 'book', 'library', 'pencil', 'terminal',
      'code', 'construct', 'bulb', 'cloud'
    ]
  },
  {
    title: 'أخرى',
    icons: [
      'star', 'bookmark', 'flag', 'notifications', 'settings', 'help-circle',
      'trash', 'layers', 'color-palette', 'camera', 'image', 'musical-notes',
      'game-controller', 'trophy'
    ]
  }
];

export const ALL_ICONS: IconName[] = ICON_PICKER_LIST.flatMap(cat => cat.icons);
