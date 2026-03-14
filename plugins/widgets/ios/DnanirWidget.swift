import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let currentDate = Date()
        let timeline = Timeline(entries: [SimpleEntry(date: currentDate)], policy: .atEnd)
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
}

struct DnanirWidgetEntryView : View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            // Dark blue background matching Dnanir theme
            Color(red: 0/255, green: 52/255, blue: 89/255)
            
            VStack(spacing: family == .systemSmall ? 8 : 12) {
                HStack {
                    VStack(alignment: .leading) {
                        Text("Dnanir")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white.opacity(0.8))
                        Text("دنانير")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.white)
                    }
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                
                HStack(spacing: family == .systemSmall ? 15 : 25) {
                    // Expense Link
                    Link(destination: URL(string: "dnanir://add-expense")!) {
                        WidgetButton(icon: "plus", color: .yellow, label: "صرف")
                    }
                    
                    // Income Link
                    Link(destination: URL(string: "dnanir://add-income")!) {
                        WidgetButton(icon: "dollarsign", color: .green, label: "دخل")
                    }
                    
                    // AI Voice Link
                    Link(destination: URL(string: "dnanir://smart-add")!) {
                        VStack(spacing: 4) {
                            ZStack {
                                Circle()
                                    .fill(LinearGradient(gradient: Gradient(colors: [Color(red: 0, green: 0.47, blue: 0.71), Color(red: 0, green: 0.66, blue: 0.91)]), startPoint: .topLeading, endPoint: .bottomTrailing))
                                    .frame(width: 44, height: 44)
                                    .shadow(color: .blue.opacity(0.5), radius: 4)
                                Image(systemName: "mic.fill")
                                    .font(.system(size: 20))
                                    .foregroundColor(.white)
                            }
                            Text("ذكاء")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(.white)
                        }
                    }
                }
                Spacer()
            }
        }
    }
}

struct WidgetButton: View {
    let icon: String
    let color: Color
    let label: String
    
    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle()
                    .fill(color.opacity(0.2))
                    .frame(width: 44, height: 44)
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(color)
            }
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(.white)
        }
    }
}

@main
struct DnanirWidget: Widget {
    let kind: String = "DnanirWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            DnanirWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("دنانير - اختصارات")
        .description("سجل مصروفاتك أو دخلك بسرعة من الشاشة الرئيسية.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
