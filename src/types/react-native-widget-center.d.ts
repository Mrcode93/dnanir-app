declare module 'react-native-widget-center' {
  export default class WidgetCenter {
    static reloadAllTimelines(): void;
    static reloadTimelines(kind: string): void;
    static getCurrentConfigurations(): Promise<any>;
  }
}
