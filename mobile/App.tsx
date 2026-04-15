import React, { useCallback, useEffect } from "react";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts as useDMSans,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  useFonts as useInstrumentSerif,
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from "@expo-google-fonts/instrument-serif";
import { AppNavigator } from "./src/navigation/AppNavigator";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [dmSansLoaded] = useDMSans({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  const [serifLoaded] = useInstrumentSerif({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  const ready = dmSansLoaded && serifLoaded;

  const onLayoutRootView = useCallback(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AppNavigator />
    </View>
  );
}
