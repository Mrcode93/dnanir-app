import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppDialog, AppButton } from '../design-system';
import { updateService, type AppUpdate } from '../services/updateService';
import { useAppTheme, useThemedStyles, type AppTheme } from '../utils/theme';
import { LinearGradient } from 'expo-linear-gradient';

interface UpdateNotificationModalProps {
  visible: boolean;
  update: AppUpdate | null;
  onClose: () => void;
}

export const UpdateNotificationModal: React.FC<UpdateNotificationModalProps> = ({
  visible,
  update,
  onClose,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  if (!update) return null;

  return (
    <AppDialog
      visible={visible}
      onClose={update.mandatory ? undefined : onClose}
      title="تحديث جديد متاح!"
      subtitle={`إصدار ${update.version} أصبح متوفراً الآن`}
    >
      <View style={styles.container}>
        {/* Animated-like Icon Container */}
        <View style={styles.iconOuter}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primary + '80'] as any}
            style={styles.iconContainer}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="rocket" size={48} color="#FFFFFF" />
          </LinearGradient>
          <View style={[styles.iconPulse, { borderColor: theme.colors.primary + '30' }]} />
        </View>

        {/* Feature Highlights */}
        <View style={styles.descriptionCard}>
          <View style={styles.descriptionHeader}>
            <Ionicons name="sparkles" size={18} color={theme.colors.primary} />
            <Text style={styles.descriptionTitle}>ما الجديد في هذا الإصدار:</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.descriptionText}>{update.description}</Text>
        </View>

        {update.mandatory && (
          <View style={styles.mandatoryContainer}>
            <View style={[styles.mandatoryBadge, { backgroundColor: theme.colors.error + '10' }]}>
              <Ionicons name="alert-circle" size={14} color={theme.colors.error} />
              <Text style={styles.mandatoryText}>تحديث إلزامي</Text>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <AppButton
            label={update.isOTA ? "تحديث الآن" : (update.downloadUrl ? "تحميل التحديث" : "فهمت، شكراً")}
            onPress={async () => {
              if (update.isOTA) {
                try {
                  await updateService.fetchAndApplyUpdate();
                } catch (error) {
                  onClose();
                }
              } else if (update.downloadUrl) {
                Linking.openURL(update.downloadUrl).catch(() => onClose());
              } else {
                onClose();
              }
            }}
            variant="primary"
            size="lg"
            style={styles.updateButton}
          />
        </View>
      </View>
    </AppDialog>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    paddingTop: 8,
  },
  iconOuter: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    elevation: 4,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconPulse: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1,
    zIndex: 1,
  },
  descriptionCard: {
    width: '100%',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border + '50',
  },
  descriptionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  descriptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.3,
    width: '60%',
    alignSelf: 'center',
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
  },
  mandatoryContainer: {
    marginBottom: 24,
  },
  mandatoryBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 50,
    gap: 6,
  },
  mandatoryText: {
    fontSize: 12,
    color: theme.colors.error,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily,
  },
  actions: {
    width: '100%',
  },
  updateButton: {
    width: '100%',
    borderRadius: 16,
  },
});
