import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DashboardScreen } from "../screens/DashboardScreen";
import { AnalyticsScreen } from "../screens/AnalyticsScreen";
import { IncomeScreen } from "../screens/IncomeScreen";
import { ExpensesScreen } from "../screens/ExpensesScreen";
import { GoalsScreen } from "../screens/GoalsScreen";
import { DebtsScreen } from "../screens/DebtsScreen";
import { BudgetScreen } from "../screens/BudgetScreen";
import { BusinessDashboardScreen } from "../screens/BusinessDashboardScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { Text } from "react-native";

const Tab = createBottomTabNavigator();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0d9488" },
        headerTintColor: "#fff",
        tabBarActiveTintColor: "#0d9488",
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📊</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Income"
        component={IncomeScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>💰</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>💸</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>🐷</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Debts"
        component={DebtsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>💳</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Budget"
        component={BudgetScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>🎯</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Business"
        component={BusinessDashboardScreen}
        options={{
          title: "Allianza Biz",
          headerStyle: { backgroundColor: "#185FA5" },
          headerTintColor: "#fff",
          tabBarActiveTintColor: "#185FA5",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>💼</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
