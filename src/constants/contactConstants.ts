/**
 * Contact information and app store links
 */

export const CONTACT_INFO = {
  email: 'ameralazawi69@gmail.com',
  whatsappNumber: '9647838584311', // WhatsApp number with country code (no + sign)
  whatsappMessage: 'مرحباً، أريد الاستفسار عن تطبيق دنانير',
  emailSubject: 'استفسار عن تطبيق دنانير',
  emailBody: 'مرحباً،\n\n',
} as const;

/** روابط التطبيق حسب المنصة - أيفون يشارك رابط App Store، أندرويد يشارك رابط المتجر */
export const APP_LINKS = {
  /** رابط تطبيق دنانير على App Store (أيفون) */
  apple: 'https://apps.apple.com/us/app/dnanir/id6753695330',
  /** رابط تطبيق دنانير على Google Play (أندرويد) - غيّره عند النشر */
  android: 'https://play.google.com/store/apps/details?id=com.urux.dnanir',
  telegram: 'https://t.me/urux_iq',
} as const;

/** رسالة المشاركة التي تظهر عند مشاركة التطبيق (واتساب أو أي تطبيق) */
export const SHARE_APP_MESSAGE = 'تطبيق دنانير - خلي كل دينار محسوب! تابع مصاريفك وميزانيتك بسهولة. حمّل التطبيق من الرابط:';
