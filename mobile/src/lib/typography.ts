// KomalFi type scale — see KOMALFI_DESIGN_SYSTEM.md §2.2
// All screens should import these presets instead of re-declaring fontSize + weight.

import { TextStyle } from "react-native";

export const fonts = {
  sans: "DMSans_400Regular",
  sansMedium: "DMSans_500Medium",
  sansSemibold: "DMSans_600SemiBold",
  sansBold: "DMSans_700Bold",
  serif: "InstrumentSerif_400Regular",
  serifItalic: "InstrumentSerif_400Regular_Italic",
};

export const text: Record<string, TextStyle> = {
  heroAmount: {
    fontFamily: fonts.sansBold,
    fontSize: 36,
    letterSpacing: -0.72,
  },

  pageTitle: {
    fontFamily: fonts.serif,
    fontSize: 28,
    letterSpacing: -0.28,
  },

  greetingName: {
    fontFamily: fonts.serif,
    fontSize: 26,
    letterSpacing: -0.26,
  },

  metricLarge: {
    fontFamily: fonts.sansBold,
    fontSize: 20,
    letterSpacing: -0.4,
  },

  statValue: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    letterSpacing: -0.36,
  },

  sectionTitle: {
    fontFamily: fonts.sansSemibold,
    fontSize: 17,
    letterSpacing: -0.17,
  },

  amount: {
    fontFamily: fonts.sansSemibold,
    fontSize: 15,
    letterSpacing: -0.15,
  },

  body: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
  },

  caption: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
  },

  captionRegular: {
    fontFamily: fonts.sans,
    fontSize: 13,
  },

  heroLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.96, // 0.08em * 12
    textTransform: "uppercase",
  },

  pillLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.66, // 0.06em * 11
    textTransform: "uppercase",
  },

  pillLabelNoUpper: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
  },

  navLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.1,
  },
};
