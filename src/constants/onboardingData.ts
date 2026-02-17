import { Ionicons } from '@expo/vector-icons';

export type OnboardingBullet = {
  title: string;
  text?: string;
};

export type OnboardingSlide = {
  key: string;
  title: string;
  description?: string;
  bullets?: OnboardingBullet[];
  icon: keyof typeof Ionicons.glyphMap;
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    key: 'welcome',
    title: 'مرحباً بك في دنانير',
    description:
      'تحكّم بأموالك بطريقة ذكية وسهلة.\nتابع مصروفاتك، افهم دخلك، وطوّر وضعك المالي بثقة.',
    icon: 'wallet-outline',
  },
  {
    key: 'benefits',
    title: 'كل ما تحتاجه لإدارة أموالك',
    bullets: [
      {
        title: 'تابع أموالك بسهولة',
        text: 'راقب الدخل والمصروفات بشكل مباشر من لوحة واضحة وبسيطة.',
      },
      {
        title: 'تحليلات ذكية',
        text: 'افهم عاداتك المالية من خلال تقارير سهلة ومفيدة.',
      },
      {
        title: 'آمن ومحمي',
        text: 'بياناتك المالية محمية بأحدث تقنيات الأمان والخصوصية.',
      },
    ],
    icon: 'stats-chart-outline',
  },
  {
    key: 'cta',
    title: 'ابدأ التحكم بأموالك اليوم',
    description: 'ابدأ رحلتك نحو إدارة مالية أذكى.\nسريع، بسيط، ومصمم لك.',
    icon: 'rocket-outline',
  },
];
