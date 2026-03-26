import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { ScreenContainer } from '../design-system';
import { useAppTheme } from '../utils/theme-context';
import { useLocalization, tl } from '../localization';
import { getPlatformFontWeight } from '../utils/theme-constants';

export const TermsScreen = ({ navigation }: any) => {
  const { theme } = useAppTheme();
  const { isRTL } = useLocalization();

  const sections = [
    {
      title: tl("1. المقدمة"),
      content: tl("أهلاً بك في تطبيق \"دنانير\". باستخدامك لهذا التطبيق، فإنك توافق على الالتزام بالشروط والأحكام المذكورة هنا. يهدف التطبيق إلى توفير أدوات لإدارة المال الشخصي وتتبع المصاريف.")
    },
    {
      title: tl("2. حساب المستخدم"),
      content: tl("المسؤولية عن أمان الحساب وكلمة المرور تقع على عاتق المستخدم بالكامل. يجب تقديم معلومات صحيحة ودقيقة عند التسجيل في الخدمة لضمان أفضل تجربة.")
    },
    {
      title: tl("3. استخدام الخدمة"),
      content: tl("يهدف التطبيق لمساعدة المستخدمين في تتبع مصاريفهم وإيراداتهم وتنظيم ميزانياتهم. المعلومات المقدمة من خلال التطبيق هي لأغراض تنظيمية وتثقيفية فقط، ولا تشكل نصيحة مالية أو قانونية أو ضريبية.")
    },
    {
      title: tl("4. الخصوصية وحماية البيانات"),
      content: tl("نحن نولي أهمية قصوى لخصوصيتك. يتم تشفير بياناتك المالية وحمايتها. نحن لا نقوم ببيع بياناتك الشخصية لأطراف ثالثة. يمكنك الاطلاع على سياسة الخصوصية لمزيد من التفاصيل حول كيفية معالجة البيانات.")
    },
    {
      title: tl("5. إخلاء المسؤولية"),
      content: tl("تطبيق \"دنانير\" هو أداة تنظيمية وحسابية فقط. نحن غير مسؤولين عن أي قرارات مالية أو استثمارية تتخذها بناءً على المعلومات الواردة في التطبيق، أو عن أي خسائر قد تنجم عن استخدام الخدمة.")
    },
    {
      title: tl("6. ملكية المحتوى"),
      content: tl("جميع العلامات التجارية والنصوص والرسوم البرمجية والتصاميم في تطبيق \"دنانير\" هي ملكية خاصة لمطوري التطبيق (URUX) ومحمية بموجب قوانين الملكية الفكرية.")
    },
    {
      title: tl("7. التحديثات والتغييرات"),
      content: tl("قد نقوم بتحديث هذه الشروط من وقت لآخر لمواكبة التطورات التقنية أو القانونية. استمرارك في استخدام التطبيق بعد إجراء هذه التغييرات يعني موافقتك على الشروط المحدثة.")
    },
    {
      title: tl("8. إنهاء الخدمة"),
      content: tl("نحتفظ بالحق في تعليق أو إنهاء وصولك إلى الخدمة في حال مخالفة هذه الشروط أو استخدام التطبيق بطرق غير قانونية أو ضارة.")
    },
    {
      title: tl("9. اتصل بنا"),
      content: tl("إذا كان لديك أي استفسارات أو ملاحظات حول هذه الشروط والأحكام، يرجى التواصل معنا عبر قسم الدعم الفني في التطبيق.")
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
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{tl("الأحكام والشروط")}</Text>
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
