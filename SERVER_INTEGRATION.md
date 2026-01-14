# Server Integration Guide

This guide explains how to integrate the دنانير app with the backend server.

## Setup

### 1. Install Dependencies

```bash
cd dnanir-app
npm install
```

This will install `@react-native-async-storage/async-storage` for token storage.

### 2. Configure API URL

Edit `src/config/api.ts` and update the `BASE_URL`:

```typescript
export const API_CONFIG = {
  BASE_URL: __DEV__ 
    ? 'http://YOUR_LOCAL_IP:3000' // For physical device testing
    : 'https://your-production-server.com',
  // ...
};
```

**Important for Physical Devices:**
- Use your computer's local IP address (not `localhost`)
- Find your IP: `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
- Example: `http://192.168.1.100:3000`

### 3. Start the Server

```bash
cd ../server
npm run dev
```

The server should run on `http://localhost:3000`

## Usage

### Authentication

```typescript
import { register, login, logout, isLoggedIn } from './services/serverAuthService';

// Register new user
try {
  const authData = await register({
    email: 'user@example.com',
    password: 'password123',
    name: 'User Name'
  });
  console.log('Registered:', authData.user);
} catch (error) {
  console.error('Registration failed:', error);
}

// Login
try {
  const authData = await login({
    email: 'user@example.com',
    password: 'password123'
  });
  console.log('Logged in:', authData.user);
} catch (error) {
  console.error('Login failed:', error);
}

// Check if logged in
const loggedIn = await isLoggedIn();

// Logout
await logout();
```

### Subscription Management

```typescript
import { 
  getSubscriptionStatus, 
  createSubscription,
  cancelSubscription 
} from './services/subscriptionApiService';

// Check subscription status
try {
  const status = await getSubscriptionStatus();
  if (status.isPremium) {
    console.log('User has premium subscription');
    console.log('Days remaining:', status.daysRemaining);
  }
} catch (error) {
  console.error('Failed to get subscription:', error);
}

// Create subscription (requires Stripe payment method)
try {
  const result = await createSubscription({
    paymentMethodId: 'pm_xxxxx' // From Stripe
  });
  console.log('Subscription created:', result.subscription);
} catch (error) {
  console.error('Failed to create subscription:', error);
}
```

### AI Services (Premium Only)

#### Receipt OCR

```typescript
import { processReceiptOCR } from './services/aiApiService';
import { processReceiptImage } from './services/receiptOCRService';

// Option 1: Use server OCR (premium)
try {
  const receiptData = await processReceiptOCR(imageUri, 'ar+en');
  console.log('Receipt data:', receiptData);
} catch (error) {
  console.error('OCR failed:', error);
}

// Option 2: Use local OCR with server fallback
const receiptData = await processReceiptImage(imageUri, true); // true = try server first
```

#### Financial Chatbot

```typescript
import { askChatbot } from './services/aiApiService';

try {
  const response = await askChatbot({
    message: 'كيف أوفر أكثر؟',
    context: {
      expenses: [...], // Recent expenses
      income: [...],    // Recent income
      goals: [...],    // Financial goals
    }
  });
  console.log('AI Response:', response.response);
  console.log('Suggestions:', response.suggestions);
} catch (error) {
  console.error('Chatbot failed:', error);
}
```

#### Expense Categorization

```typescript
import { categorizeExpense } from './services/aiApiService';

try {
  const result = await categorizeExpense({
    description: 'شراء قهوة من ستاربكس',
    amount: 15.50
  });
  console.log('Category:', result.category);
  console.log('Confidence:', result.confidence);
} catch (error) {
  console.error('Categorization failed:', error);
}
```

#### Financial Analysis

```typescript
import { analyzeFinancialData } from './services/aiApiService';

try {
  const analysis = await analyzeFinancialData({
    expenses: [...], // Array of expenses
    income: [...],  // Array of income
    goals: [...],   // Optional: financial goals
    budget: {...}   // Optional: budget data
  });
  
  console.log('Spending patterns:', analysis.spendingPatterns);
  console.log('Insights:', analysis.insights);
  console.log('Recommendations:', analysis.recommendations);
  console.log('Predictions:', analysis.predictions);
  console.log('Anomalies:', analysis.anomalies);
} catch (error) {
  console.error('Analysis failed:', error);
}
```

## Integration Examples

### Update Receipt Scanner Component

```typescript
import { processReceiptImage } from '../services/receiptOCRService';
import { getSubscriptionStatus } from '../services/subscriptionApiService';

const handleReceiptScan = async (imageUri: string) => {
  try {
    // Check if user has premium
    const subscription = await getSubscriptionStatus();
    const useServer = subscription.isPremium;
    
    // Process receipt (will use server if premium, local otherwise)
    const receiptData = await processReceiptImage(imageUri, useServer);
    
    // Use receiptData...
  } catch (error) {
    console.error('Failed to process receipt:', error);
  }
};
```

### Add Premium Check Before AI Features

```typescript
import { getSubscriptionStatus } from '../services/subscriptionApiService';

const usePremiumFeature = async () => {
  try {
    const status = await getSubscriptionStatus();
    if (!status.isPremium) {
      // Show upgrade prompt
      Alert.alert(
        'ميزة مميزة',
        'هذه الميزة تتطلب اشتراك مميز. هل تريد الترقية؟',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'ترقية', onPress: () => navigateToSubscription() }
        ]
      );
      return;
    }
    
    // Use premium feature...
  } catch (error) {
    console.error('Failed to check subscription:', error);
  }
};
```

## Error Handling

All API services throw errors that should be caught:

```typescript
try {
  await someApiCall();
} catch (error: any) {
  if (error.message.includes('Premium subscription required')) {
    // Handle premium requirement
  } else if (error.message.includes('Network error')) {
    // Handle network issues
  } else if (error.message.includes('Invalid credentials')) {
    // Handle auth errors
  } else {
    // Handle other errors
  }
}
```

## Token Management

Tokens are automatically stored and included in API requests. The `apiService` handles:
- Storing access and refresh tokens
- Including tokens in request headers
- Clearing tokens on logout

## Testing

1. **Start the server:**
   ```bash
   cd server
   npm run dev
   ```

2. **Update API config** with your local IP

3. **Test authentication:**
   - Register a new user
   - Login with credentials
   - Check if tokens are stored

4. **Test premium features:**
   - Create a subscription (requires Stripe setup)
   - Test AI services

## Notes

- All AI services require premium subscription
- Tokens are stored securely using AsyncStorage
- Network errors are handled gracefully
- The app falls back to local OCR if server OCR fails
- Server URL should be configured for your environment
