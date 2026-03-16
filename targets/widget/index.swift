import WidgetKit
import SwiftUI
import AppIntents
import Foundation

// MARK: - Configuration Intent
public struct ConfigurationAppIntent: WidgetConfigurationIntent {
    public static var title: LocalizedStringResource = "إعدادات دنانير"
    public static var description = IntentDescription("تخصيص الوجت")

    @Parameter(title: "العملة", default: "IQD")
    public var currency: String
    
    public init() {}
}

// MARK: - Widget Timeline
public struct SimpleEntry: TimelineEntry {
    public let date: Date
    public let balance: String
    public let income: String
    public let expenses: String
    public let currency: String
    public let isPrivate: Bool
    public let themeMode: String 
    public let configuration: ConfigurationAppIntent
}

public struct Provider: AppIntentTimelineProvider {
    public func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), balance: "0", income: "0", expenses: "0", currency: "IQD", isPrivate: false, themeMode: "system", configuration: ConfigurationAppIntent())
    }
    public func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> SimpleEntry {
        SimpleEntry(date: Date(), balance: "1,250,500", income: "1,500,000", expenses: "250,000", currency: "IQD", isPrivate: false, themeMode: "system", configuration: configuration)
    }
    public func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<SimpleEntry> {
        let shared = UserDefaults(suiteName: "group.com.mrcodeiq.dinar")
        let bal = Double(shared?.string(forKey: "widget_balance_raw") ?? "0") ?? 0
        let inc = Double(shared?.string(forKey: "widget_income_raw") ?? "0") ?? 0
        let exp = Double(shared?.string(forKey: "widget_expenses_raw") ?? "0") ?? 0
        let curr = shared?.string(forKey: "widget_currency") ?? "IQD"
        let priv = shared?.string(forKey: "privacy_mode") == "true"
        let theme = shared?.string(forKey: "widget_theme_mode") ?? "system"
        
        let f = NumberFormatter()
        f.numberStyle = .decimal
        let balanceText = f.string(from: NSNumber(value: bal)) ?? "0"
        let incomeText = f.string(from: NSNumber(value: inc)) ?? "0"
        let expenseText = f.string(from: NSNumber(value: exp)) ?? "0"
        
        let entry = SimpleEntry(date: Date(), balance: balanceText, income: incomeText, expenses: expenseText, currency: curr, isPrivate: priv, themeMode: theme, configuration: configuration)
        return Timeline(entries: [entry], policy: .atEnd)
    }
}

// MARK: - UI Components
struct AppFont {
    static func bold(size: CGFloat) -> Font {
        return Font.custom("DINNextLTW23-Medium", size: size).weight(.bold)
    }
    static func regular(size: CGFloat) -> Font {
        return Font.custom("DINNextLTW23-Regular", size: size)
    }
    static func black(size: CGFloat) -> Font {
        return Font.custom("DINNextLTW23-Medium", size: size).weight(.black)
    }
}

struct CircularActionButton: View {
    let icon: String
    let color: Color
    let gradient: LinearGradient?
    let size: CGFloat
    
    init(icon: String, color: Color, gradient: LinearGradient? = nil, size: CGFloat = 52) {
        self.icon = icon
        self.color = color
        self.gradient = gradient
        self.size = size
    }
    
    var body: some View {
        ZStack {
            if let gradient = gradient {
                Circle()
                    .fill(gradient)
                    .frame(width: size, height: size)
                    .shadow(color: Color.blue.opacity(0.3), radius: 5, x: 0, y: 3)
            } else {
                Circle()
                    .fill(color.opacity(0.15))
                    .frame(width: size, height: size)
                Circle()
                    .strokeBorder(color.opacity(0.2), lineWidth: 1)
                    .frame(width: size, height: size)
            }
            
            Image(systemName: icon)
                .font(.system(size: size * 0.42, weight: .bold))
                .foregroundColor(gradient != nil ? .white : color)
        }
    }
}

struct MiniStatBox: View {
    let label: String
    let value: String
    let color: Color
    let isPrivate: Bool
    let colorScheme: ColorScheme
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(AppFont.bold(size: 10))
                .foregroundColor(colorScheme == .dark ? .white.opacity(0.5) : .black.opacity(0.5))
                .multilineTextAlignment(.leading)
            Text(isPrivate ? "****" : value)
                .font(AppFont.bold(size: 14))
                .foregroundColor(colorScheme == .dark ? .white : .black)
                .multilineTextAlignment(.leading)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(colorScheme == .dark ? Color.white.opacity(0.06) : Color.black.opacity(0.04))
        .cornerRadius(12)
    }
}

struct WidgetEntryView : View {
    var entry: SimpleEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var systemColorScheme
    
    var activeColorScheme: ColorScheme? {
        if entry.themeMode == "dark" { return .dark }
        if entry.themeMode == "light" { return .light }
        return nil
    }
    
    var body: some View {
        let scheme = activeColorScheme ?? systemColorScheme
        
        VStack(spacing: 0) {
            // Header
            HStack(alignment: .top) {
                // App Brand
                Text("دنانير")
                    .font(AppFont.black(size: family == .systemSmall ? 16 : 20))
                    .foregroundColor(scheme == .dark ? .white : .black)
                
                Spacer()
                
                // Balance Section
                VStack(alignment: .leading, spacing: 0) {
                    Text(entry.isPrivate ? "****" : entry.balance)
                        .font(AppFont.black(size: family == .systemSmall ? 22 : 28))
                        .foregroundColor(scheme == .dark ? .white : .black)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    
                    Text("\(entry.currency) / الرصيد")
                        .font(AppFont.bold(size: 8))
                        .foregroundColor(scheme == .dark ? .white.opacity(0.4) : .black.opacity(0.4))
                }
            }
            .padding(.horizontal, family == .systemSmall ? 16 : 24)
            .padding(.top, family == .systemSmall ? 12 : 20)
            
            if family == .systemMedium {
                Spacer()
                // Stats Box (Medium only)
                HStack(spacing: 12) {
                    MiniStatBox(label: "دخل", value: entry.income, color: .green, isPrivate: entry.isPrivate, colorScheme: scheme)
                    MiniStatBox(label: "صرف", value: entry.expenses, color: .red, isPrivate: entry.isPrivate, colorScheme: scheme)
                }
            }
            
            Spacer()
            
            // Buttons
            HStack(spacing: family == .systemSmall ? 14 : 28) {
                Link(destination: URL(string: "dnanir://smart-add")!) {
                    CircularActionButton(
                        icon: "mic.fill",
                        color: .blue,
                        gradient: LinearGradient(colors: [.blue, .cyan], startPoint: .topLeading, endPoint: .bottomTrailing),
                        size: family == .systemSmall ? 40 : 54
                    )
                }
                
                Link(destination: URL(string: "dnanir://add-income")!) {
                    CircularActionButton(icon: "plus", color: .green, size: family == .systemSmall ? 40 : 54)
                }
                
                Link(destination: URL(string: "dnanir://add-expense")!) {
                    CircularActionButton(icon: "minus", color: .red, size: family == .systemSmall ? 40 : 54)
                }
            }
            .padding(.bottom, family == .systemSmall ? 16 : 24)
        }
        .environment(\.layoutDirection, .rightToLeft)
        .preferredColorScheme(activeColorScheme)
    }
}

// MARK: - Main Widget
struct DnanirWidget: Widget {
    let kind: String = "DnanirWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: ConfigurationAppIntent.self, provider: Provider()) { entry in
            WidgetEntryView(entry: entry)
                .containerBackground(for: .widget) {
                    ZStack {
                        if entry.themeMode == "light" {
                            Color(red: 0.96, green: 0.97, blue: 0.98)
                        } else if entry.themeMode == "dark" {
                            Color(red: 0.05, green: 0.07, blue: 0.12)
                            RadialGradient(colors: [Color.blue.opacity(0.12), .clear], center: .topTrailing, startRadius: 0, endRadius: 200)
                        } else {
                            DynamicBackgroundView()
                        }
                    }
                }
        }
        .configurationDisplayName("دنانير")
        .description("الإدارة الذكية لأموالك.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct DynamicBackgroundView: View {
    @Environment(\.colorScheme) var scheme
    
    var body: some View {
        ZStack {
            if scheme == .dark {
                Color(red: 0.05, green: 0.07, blue: 0.12)
                RadialGradient(colors: [Color.blue.opacity(0.12), .clear], center: .topTrailing, startRadius: 0, endRadius: 200)
            } else {
                Color(red: 0.96, green: 0.97, blue: 0.98)
                RadialGradient(colors: [Color.blue.opacity(0.05), .clear], center: .topTrailing, startRadius: 0, endRadius: 200)
            }
        }
    }
}

@main
struct DnanirWidgetBundle: WidgetBundle {
    var body: some Widget {
        DnanirWidget()
    }
}
