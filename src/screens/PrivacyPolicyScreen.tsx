import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { ScreenContainer } from '../design-system';
import { useAppTheme } from '../utils/theme-context';
import { useLocalization, tl } from '../localization';
import { getPlatformFontWeight } from '../utils/theme-constants';

export const PrivacyPolicyScreen = ({ navigation }: any) => {
  const { theme } = useAppTheme();
  const { isRTL } = useLocalization();

  const sections = [
    {
      title: tl("1. تخزين البيانات وحفظها"),
      content: tl("نحن لا نقوم بجمع بياناتك الشخصية لأطراض خارجية، بل نقوم فقط بحفظ البيانات التي تدخلها (مثل المصاريف، الإيرادات، وأسماء المحافظ) في قاعدة بياناتنا الخاصة بك لتتمكن من الوصول إليها وإدارتها في أي وقت.")
    },
    {
      title: tl("2. كيف نستخدم بياناتك"),
      content: tl("نستخدم بياناتك حصراً لتوفير ميزات التطبيق لك، مثل التقارير المالية والتحليلات الذكية. يتم حفظ هذه البيانات لغرض تزويدك بالمعلومات المالية الخاصة بك فقط.")
    },
    {
      title: tl("3. حماية البيانات"),
      content: tl("بياناتك المالية مشفرة ومخزنة بأمان. نحن نستخدم تقنيات حديثة لحماية بياناتك من الوصول غير المصرح به. بياناتك ملك لك وحدك ونحن نوفر لك الوسيلة لحفظها بشكل آمن.")
    },
    {
      title: tl("4. عدم مشاركة البيانات"),
      content: tl("نحن لا نبيع ولا نشارك بياناتك الشخصية أو المالية مع أي أطراف ثالثة. هدفنا هو توفير أداة آمنة وخاصة لإدارة أموالك.")
    },
    {
      title: tl("5. حقوقك كصاحب بيانات"),
      content: tl("لديك الحق الكامل في الوصول إلى بياناتك، تعديلها، أو حذفها في أي وقت من خلال إعدادات التطبيق. يمكنك أيضاً تصدير بياناتك بتنسيق PDF أو نسخ احتياطية.")
    },
    {
      title: tl("6. استخدام الكوكيز"),
      content: tl("تطبيقنا لا يستخدم ملفات تعريف الارتباط (Cookies) كما لا يستخدم أي تقنيات تتبع لمراقبة نشاطك.")
    },
    {
      title: tl("7. خصوصية الأطفال"),
      content: tl("تطبيقنا غير موجه للأطفال دون سن 13 عاماً. نحن لا نجمع بيانات الأطفال عمداً. إذا علمنا بجمع بيانات طفل عن طريق الخطأ، فسنقوم بحذفها فوراً.")
    },
    {
      title: tl("8. التعديلات على سياسة الخصوصية"),
      content: tl("نحتفظ بالحق في تعديل سياسة الخصوصية هذه في أي وقت. سنقوم بإخطارك بأي تغييرات جوهرية من خلال التطبيق أو عبر البريد الإلكتروني.")
    },
    {
      title: tl("9. تواصل معنا"),
      content: tl("إذا كان لديك أي أسئلة حول سياسة الخصوصية الخاصة بنا، يرجى التواصل معنا عبر واتساب +9647838584311 أو البريد الإلكتروني ameralazawi69@gmail.com")
    }
  ];

  const styles = React.useMemo(() => createStyles(theme, isRTL), [theme, isRTL]);

  return (
    <ScreenContainer scrollable={false} style={{ backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{tl("سياسة الخصوصية")}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{tl("آخر تحديث: مارس 2026")}</Text>
        </View>

        <View style={[styles.contentCard, { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.border + '20' }]}>
          {sections.map((section, index) => (
            <View key={index} style={[styles.section, index !== sections.length - 1 && styles.sectionBorder, { borderBottomColor: theme.colors.border + '15' }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>{section.title}</Text>
              <Text style={[styles.sectionContent, { color: theme.colors.textSecondary }]}>{section.content}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>© 2026 URUX - {tl("جميع الحقوق محفوظة")}</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const createStyles = (theme: any, isRTL: boolean) => StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: getPlatformFontWeight('800'),
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    opacity: 0.8,
  },
  contentCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  section: {
    paddingVertical: 16,
  },
  sectionBorder: {
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
    marginBottom: 8,
    textAlign: isRTL ? 'right' : 'left',
  },
  sectionContent: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily,
    lineHeight: 24,
    textAlign: isRTL ? 'right' : 'left',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
});
