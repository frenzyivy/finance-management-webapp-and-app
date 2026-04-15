import React, { useEffect, useState } from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabs } from "./MainTabs";
import { AddGoalScreen } from "../screens/AddGoalScreen";
import { AddDebtScreen } from "../screens/AddDebtScreen";
import { AddIncomeScreen } from "../screens/AddIncomeScreen";
import { AddExpenseScreen } from "../screens/AddExpenseScreen";
import { ExpensesScreen } from "../screens/ExpensesScreen";
import { GoalsScreen } from "../screens/GoalsScreen";
import { DebtsScreen } from "../screens/DebtsScreen";
import { BudgetScreen } from "../screens/BudgetScreen";
import { BusinessDashboardScreen } from "../screens/BusinessDashboardScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ImportsScreen } from "../screens/ImportsScreen";
import { SmsScanScreen } from "../screens/SmsScanScreen";
import { TransactionReviewScreen } from "../screens/TransactionReviewScreen";
import { CreditCardsScreen } from "../screens/CreditCardsScreen";
import { AddCreditCardScreen } from "../screens/AddCreditCardScreen";
import { YearReviewScreen } from "../screens/YearReviewScreen";
import { BusinessIncomeScreen } from "../screens/BusinessIncomeScreen";
import { AddBusinessIncomeScreen } from "../screens/AddBusinessIncomeScreen";
import { BusinessExpensesScreen } from "../screens/BusinessExpensesScreen";
import { AddBusinessExpenseScreen } from "../screens/AddBusinessExpenseScreen";
import { BusinessSubscriptionsScreen } from "../screens/BusinessSubscriptionsScreen";
import { AddBusinessSubscriptionScreen } from "../screens/AddBusinessSubscriptionScreen";
import { BusinessClientsScreen } from "../screens/BusinessClientsScreen";
import { AddBusinessClientScreen } from "../screens/AddBusinessClientScreen";
import { ScanBnplInvoiceScreen } from "../screens/ScanBnplInvoiceScreen";
import { CCStatementUploadScreen } from "../screens/CCStatementUploadScreen";
import { TransfersScreen } from "../screens/TransfersScreen";
import { AddTransferScreen } from "../screens/AddTransferScreen";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import { ThemeProvider, useTheme } from "../lib/theme-context";
import type { IncomeEntry, ExpenseEntry, SavingsGoal, Debt, CreditCard } from "../types/database";
import type { BusinessIncome, BusinessExpense, BusinessSubscription, BusinessClient } from "../types/business";

export type RootStackParamList = {
  Main: undefined;
  AddIncome: { entry?: IncomeEntry } | undefined;
  AddExpense: { entry?: ExpenseEntry } | undefined;
  AddGoal: { goal?: SavingsGoal } | undefined;
  AddDebt: { debt?: Debt } | undefined;
  Expenses: undefined;
  Goals: undefined;
  Debts: undefined;
  Budget: undefined;
  Business: undefined;
  Settings: undefined;
  CreditCards: undefined;
  AddCreditCard: { card?: CreditCard } | undefined;
  YearReview: undefined;
  Imports: undefined;
  SmsScan: undefined;
  TransactionReview: undefined;
  BusinessIncome: undefined;
  AddBusinessIncome: { entry?: BusinessIncome } | undefined;
  BusinessExpenses: undefined;
  AddBusinessExpense: { entry?: BusinessExpense } | undefined;
  BusinessSubscriptions: undefined;
  AddBusinessSubscription: { entry?: BusinessSubscription } | undefined;
  BusinessClients: undefined;
  AddBusinessClient: { entry?: BusinessClient } | undefined;
  ScanBnplInvoice: undefined;
  CCStatementUpload: { creditCardId: string; cardName?: string } | undefined;
  Transfers: undefined;
  AddTransfer: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function InnerStack({ session }: { session: Session | null }) {
  const { isDark, colors } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      {session ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Expenses" component={ExpensesScreen} />
          <Stack.Screen name="Goals" component={GoalsScreen} />
          <Stack.Screen name="Debts" component={DebtsScreen} />
          <Stack.Screen name="Budget" component={BudgetScreen} />
          <Stack.Screen name="Business" component={BusinessDashboardScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="CreditCards" component={CreditCardsScreen} />
          <Stack.Screen name="YearReview" component={YearReviewScreen} />
          <Stack.Screen name="Imports" component={ImportsScreen} />
          <Stack.Screen name="SmsScan" component={SmsScanScreen} />
          <Stack.Screen name="TransactionReview" component={TransactionReviewScreen} />
          <Stack.Screen name="BusinessIncome" component={BusinessIncomeScreen} />
          <Stack.Screen name="BusinessExpenses" component={BusinessExpensesScreen} />
          <Stack.Screen name="BusinessSubscriptions" component={BusinessSubscriptionsScreen} />
          <Stack.Screen name="BusinessClients" component={BusinessClientsScreen} />
          <Stack.Screen name="Transfers" component={TransfersScreen} />

          <Stack.Screen
            name="AddGoal"
            component={AddGoalScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="AddDebt"
            component={AddDebtScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="AddIncome"
            component={AddIncomeScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="AddExpense"
            component={AddExpenseScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="AddCreditCard"
            component={AddCreditCardScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="AddBusinessIncome"
            component={AddBusinessIncomeScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="AddBusinessExpense"
            component={AddBusinessExpenseScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="AddBusinessSubscription"
            component={AddBusinessSubscriptionScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="AddBusinessClient"
            component={AddBusinessClientScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="ScanBnplInvoice"
            component={ScanBnplInvoiceScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="CCStatementUpload"
            component={CCStatementUploadScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="AddTransfer"
            component={AddTransferScreen}
            options={{ presentation: "modal" }}
          />
        </Stack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

export function AppNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useRealtimeSync(session?.user?.id);

  if (loading) return null;

  return (
    <ThemeProvider>
      <InnerStack session={session} />
    </ThemeProvider>
  );
}
