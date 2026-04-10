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

const Stack = createNativeStackNavigator();

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

  if (loading) return null;

  return (
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
            options={{
              presentation: "modal",
              title: "New Goal",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="AddDebt"
            component={AddDebtScreen}
            options={{
              presentation: "modal",
              title: "Add Debt",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="AddIncome"
            component={AddIncomeScreen}
            options={{
              presentation: "modal",
              title: "Add Income",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen
            name="AddExpense"
            component={AddExpenseScreen}
            options={{
              presentation: "modal",
              title: "Add Expense",
              headerStyle: { backgroundColor: "#0d9488" },
              headerTintColor: "#fff",
            }}
          />
        </Stack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
