import React, { useState } from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DashboardScreen } from "../screens/DashboardScreen";
import { AnalyticsScreen } from "../screens/AnalyticsScreen";
import { IncomeScreen } from "../screens/IncomeScreen";
import { MoreScreen } from "../screens/MoreScreen";
import { BottomTabBar } from "../components/BottomTabBar";
import { AddSheet } from "../components/AddSheet";

const Tab = createBottomTabNavigator();

// Placeholder — the Add tab is intercepted by the custom tab bar and never rendered.
function AddPlaceholder() {
  return <View />;
}

export function MainTabs() {
  const [addOpen, setAddOpen] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();

  const handlePick = (key: string) => {
    // Route each AddSheet selection to its corresponding stack screen.
    navigation.navigate(key as never);
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <BottomTabBar
            state={props.state}
            navigation={props.navigation}
            onAddPress={() => setAddOpen(true)}
          />
        )}
      >
        <Tab.Screen name="Home" component={DashboardScreen} />
        <Tab.Screen name="Analytics" component={AnalyticsScreen} />
        <Tab.Screen name="Add" component={AddPlaceholder} />
        <Tab.Screen name="Income" component={IncomeScreen} />
        <Tab.Screen name="More" component={MoreScreen} />
      </Tab.Navigator>

      <AddSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onPick={handlePick}
      />
    </>
  );
}
