import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabs } from "./MainTabs";
import { AddGoalScreen } from "../screens/AddGoalScreen";
import { AddDebtScreen } from "../screens/AddDebtScreen";
import { AddIncomeScreen } from "../screens/AddIncomeScreen";
import { AddExpenseScreen } from "../screens/AddExpenseScreen";
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
    <NavigationContainer>
      {session ? (
        <Stack.Navigator>
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AddGoal"
            component={AddGoalScreen}
            options={({ route }) => ({
              presentation: "modal",
              title: route.params?.goal ? "Edit Goal" : "New Goal",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            })}
          />
          <Stack.Screen
            name="AddDebt"
            component={AddDebtScreen}
            options={({ route }) => ({
              presentation: "modal",
              title: route.params?.debt ? "Edit Debt" : "Add Debt",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            })}
          />
          <Stack.Screen
            name="AddIncome"
            component={AddIncomeScreen}
            options={({ route }) => ({
              presentation: "modal",
              title: route.params?.entry ? "Edit Income" : "Add Income",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            })}
          />
          <Stack.Screen
            name="AddExpense"
            component={AddExpenseScreen}
            options={({ route }) => ({
              presentation: "modal",
              title: route.params?.entry ? "Edit Expense" : "Add Expense",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            })}
          />
          <Stack.Screen
            name="CreditCards"
            component={CreditCardsScreen}
            options={{
              title: "Credit Cards",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="AddCreditCard"
            component={AddCreditCardScreen}
            options={({ route }) => ({
              presentation: "modal",
              title: route.params?.card ? "Edit Card" : "Add Card",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            })}
          />
          <Stack.Screen
            name="YearReview"
            component={YearReviewScreen}
            options={{
              title: "Year in Review",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="Imports"
            component={ImportsScreen}
            options={{
              title: "Import Transactions",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="SmsScan"
            component={SmsScanScreen}
            options={{
              title: "Scan SMS",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="TransactionReview"
            component={TransactionReviewScreen}
            options={{
              title: "Review Imports",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="BusinessIncome"
            component={BusinessIncomeScreen}
            options={{
              title: "Business Income",
              headerStyle: { backgroundColor: "#185FA5" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="AddBusinessIncome"
            component={AddBusinessIncomeScreen}
            options={({ route }) => ({
              presentation: "modal",
              title: route.params?.entry ? "Edit Income" : "Add Business Income",
              headerStyle: { backgroundColor: "#185FA5" },
              headerTintColor: "#fff",
            })}
          />
          <Stack.Screen
            name="BusinessExpenses"
            component={BusinessExpensesScreen}
            options={{
              title: "Business Expenses",
              headerStyle: { backgroundColor: "#185FA5" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="AddBusinessExpense"
            component={AddBusinessExpenseScreen}
            options={({ route }) => ({
              presentation: "modal",
              title: route.params?.entry ? "Edit Expense" : "Add Business Expense",
              headerStyle: { backgroundColor: "#185FA5" },
              headerTintColor: "#fff",
            })}
          />
          <Stack.Screen
            name="BusinessSubscriptions"
            component={BusinessSubscriptionsScreen}
            options={{
              title: "Subscriptions",
              headerStyle: { backgroundColor: "#185FA5" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="AddBusinessSubscription"
            component={AddBusinessSubscriptionScreen}
            options={({ route }) => ({
              presentation: "modal",
              title: route.params?.entry ? "Edit Subscription" : "Add Subscription",
              headerStyle: { backgroundColor: "#185FA5" },
              headerTintColor: "#fff",
            })}
          />
          <Stack.Screen
            name="BusinessClients"
            component={BusinessClientsScreen}
            options={{
              title: "Clients",
              headerStyle: { backgroundColor: "#185FA5" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="AddBusinessClient"
            component={AddBusinessClientScreen}
            options={({ route }) => ({
              presentation: "modal",
              title: route.params?.entry ? "Edit Client" : "Add Client",
              headerStyle: { backgroundColor: "#185FA5" },
              headerTintColor: "#fff",
            })}
          />
          <Stack.Screen
            name="ScanBnplInvoice"
            component={ScanBnplInvoiceScreen}
            options={{
              presentation: "modal",
              title: "Scan BNPL Invoice",
              headerStyle: { backgroundColor: "#111827" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="CCStatementUpload"
            component={CCStatementUploadScreen}
            options={{
              presentation: "modal",
              title: "Upload CC Statement",
              headerStyle: { backgroundColor: "#004B87" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="Transfers"
            component={TransfersScreen}
            options={{
              title: "Transfers",
              headerStyle: { backgroundColor: "#185FA5" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="AddTransfer"
            component={AddTransferScreen}
            options={{
              presentation: "modal",
              title: "Log Transfer",
              headerStyle: { backgroundColor: "#185FA5" },
              headerTintColor: "#fff",
            }}
          />
        </Stack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
    </ThemeProvider>
  );
}
