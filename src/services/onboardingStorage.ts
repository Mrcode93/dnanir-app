import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@dnanir_has_seen_onboarding';

const getHasSeenOnboarding = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch (error) {
    return false;
  }
};

const setHasSeenOnboarding = async (value: boolean = true): Promise<void> => {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, value ? 'true' : 'false');
  } catch (error) {
    // Ignore persistence errors to avoid blocking the user
  }
};

const clearHasSeenOnboarding = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch (error) {
    // Ignore removal errors
  }
};

export const onboardingStorage = {
  getHasSeenOnboarding,
  setHasSeenOnboarding,
  clearHasSeenOnboarding,
};
