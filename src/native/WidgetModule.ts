import { NativeModules, Platform } from 'react-native';

interface WidgetModuleInterface {
  updateWidgets(): void;
  updateWidgetData(data: any): void;
}

const { WidgetModule } = NativeModules;

export default WidgetModule as WidgetModuleInterface | undefined;
