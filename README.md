# دنانير - Smart Financial App

A smart, Iraqi-themed financial app built with React Native and Expo that helps users track their daily expenses and income, manage their personal budget intelligently, and receive financial insights and recommendations.

## 🎯 Features

### Core Features (MVP)
- **Expense Management**: Add, edit, delete, and categorize expenses
- **Income Management**: Record and track income sources
- **Dashboard**: View total income, expenses, and balance with visual charts
- **Smart Insights**: AI-powered financial analysis and recommendations
- **Local Storage**: SQLite database for offline-first experience
- **Iraqi Arabic Support**: Full localization in Iraqi Arabic

### Categories & Sources
- **Expense Categories**: Food (طعام), Bills (فواتير), Entertainment (ترفيه), Transport (مواصلات), Shopping (تسوق), Health (صحة), Education (تعليم), Other (أخرى)
- **Income Sources**: Salary (راتب), Freelance (عمل حر), Grants (منح), Investment (استثمار), Other (أخرى)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn
- Expo CLI
- iOS Simulator or Android Emulator (or physical device with Expo Go app)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Sachmah
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on device/simulator**
   ```bash
   # For iOS
   npm run ios
   
   # For Android
   npm run android
   
   # For web
   npm run web
   ```

## 🏗️ Project Structure

```
Sachmah/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── AddEditExpenseModal.tsx
│   │   ├── AddEditIncomeModal.tsx
│   │   └── WelcomeScreen.tsx
│   ├── database/           # Database operations
│   │   └── database.ts
│   ├── navigation/         # Navigation setup
│   │   └── AppNavigator.tsx
│   ├── screens/           # Main app screens
│   │   ├── DashboardScreen.tsx
│   │   ├── ExpensesScreen.tsx
│   │   ├── IncomeScreen.tsx
│   │   └── InsightsScreen.tsx
│   ├── services/          # Business logic
│   │   └── financialService.ts
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts
│   └── utils/             # Utility functions
│       └── sampleData.ts
├── App.tsx                # Main app component
└── package.json
```

## 🎨 Design & Branding

- **Colors**: Money green (#2E7D32) + Orange accent (#FF9800)
- **Language**: Iraqi Arabic with fun and humorous tone
- **Taglines**: 
  - "دنانير: Every Dinar Counts!"
  - "Be دنانير, make your money work smart!"

## 🛠️ Tech Stack

- **Frontend**: React Native with Expo
- **Language**: TypeScript
- **UI Library**: React Native Paper
- **Navigation**: React Navigation
- **Database**: SQLite (expo-sqlite)
- **Charts**: react-native-chart-kit
- **Icons**: Expo Vector Icons

## 📱 Screens

1. **Welcome Screen**: App introduction and feature overview
2. **Dashboard**: Financial overview with balance, charts, and insights
3. **Expenses**: Expense management with filtering and search
4. **Income**: Income tracking and management
5. **Insights**: Smart financial analysis and recommendations

## 🧠 Smart Features

The app provides intelligent financial insights including:
- Balance analysis and recommendations
- Expense-to-income ratio monitoring
- Top spending category identification
- Savings goal tracking
- Financial health scoring
- Trend analysis with charts

## 🔮 Future Features

- **AI Integration**: OpenAI GPT-4/5 API for advanced financial analysis
- **Smart Chatbot**: Iraqi Arabic financial assistant
- **Cloud Sync**: User accounts and data synchronization
- **Predictive Analytics**: Future spending predictions
- **Budget Alerts**: Smart notifications and reminders

## 📊 Sample Data

The app comes with sample data to demonstrate its features:
- Sample expenses across different categories
- Sample income from various sources
- Realistic financial scenarios for testing

## 🌍 Localization

The app is fully localized in Iraqi Arabic with:
- All UI text in Iraqi Arabic
- Date formatting for Iraqi locale
- Currency formatting in Iraqi Dinars
- Cultural context in financial advice

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with love for the Iraqi community
- Inspired by the need for accessible financial management tools
- Special thanks to the React Native and Expo communities

---

**دنانير** - Making every dinar count! 💰
