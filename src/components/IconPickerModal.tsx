import React, { useState, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { AppBottomSheet, AppInput } from '../design-system';
import { ICON_PICKER_LIST, IconName } from '../constants/icons';
import { tl, useLocalization } from '../localization';

interface IconPickerModalProps {
  visible: boolean;
  selectedIcon: string | null;
  onSelect: (iconName: string) => void;
  onClose: () => void;
  title?: string;
}

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 4;
const ICON_GAP = 8;
const HORIZONTAL_PADDING = 68; // (SPACING.screenH * 2) + (grid paddingHorizontal * 2) + allowance for gaps
const ICON_SIZE = (width - HORIZONTAL_PADDING - (ICON_GAP * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

// Optimization: Memoized Icon Component
const MemoIconItem = memo(({ 
  iconName, 
  isSelected, 
  onSelect, 
  theme 
}: { 
  iconName: string, 
  isSelected: boolean, 
  onSelect: (name: string) => void,
  theme: any
}) => {
  const styles = createIconStyles(theme);
  return (
    <TouchableOpacity
      onPress={() => onSelect(iconName)}
      style={[
        styles.iconItem,
        isSelected && styles.iconItemSelected,
      ]}
      activeOpacity={0.7}
    >
      <Ionicons 
        name={iconName as any} 
        size={28} 
        color={isSelected ? theme.colors.primary : theme.colors.textSecondary} 
      />
    </TouchableOpacity>
  );
});

// Helper for icon styles to keep them decoupled for memo
const createIconStyles = (theme: any) => StyleSheet.create({
  iconItem: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border + '20',
  },
  iconItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
    borderWidth: 2,
    ...getPlatformShadow('sm'),
  },
});

export const IconPickerModal: React.FC<IconPickerModalProps> = ({
  visible,
  selectedIcon,
  onSelect,
  onClose,
  title = tl("اختر الأيقونة"),
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { isRTL } = useLocalization();
  const [searchQuery, setSearchQuery] = useState('');

  // Optimization: Memoize the search results
  const filteredIconList = useMemo(() => {
    if (!searchQuery.trim()) return ICON_PICKER_LIST;
    
    const query = searchQuery.toLowerCase();
    return ICON_PICKER_LIST.map(cat => ({
        ...cat,
        icons: cat.icons.filter(icon => icon.toLowerCase().includes(query))
      })).filter(cat => cat.icons.length > 0);
  }, [searchQuery]);

  // Optimization: Don't render costly list if not visible
  if (!visible) return null;

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      height="80%"
    >
      <View style={styles.container}>
        <AppInput
          placeholder={tl("بحث عن أيقونة...")}
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon="search"
          containerStyle={styles.searchBar}
        />

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredIconList.map((category, catIdx) => (
            <View key={catIdx} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <View style={styles.iconGrid}>
                {category.icons.map((iconName) => (
                  <MemoIconItem
                    key={iconName}
                    iconName={iconName}
                    isSelected={selectedIcon === iconName}
                    onSelect={(name) => {
                      onSelect(name);
                      onClose();
                      setSearchQuery('');
                    }}
                    theme={theme}
                  />
                ))}
              </View>
            </View>
          ))}
          {filteredIconList.length === 0 && (
              <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={theme.colors.border} />
                  <Text style={styles.emptyText}>{tl("لا توجد نتائج")}</Text>
              </View>
          )}
        </ScrollView>
      </View>
    </AppBottomSheet>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: theme.spacing.sm,
  },
  searchBar: {
    marginBottom: theme.spacing.md,
    marginHorizontal: theme.spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  categorySection: {
    marginBottom: theme.spacing.lg,
  },
  categoryTitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    textAlign: 'right', // Standard for this app as it's forced RTL
  },
  iconGrid: {
    flexDirection: 'row', // System handles RTL automatically
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center', // Center icons for better visual balance
    paddingHorizontal: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
  }
});
