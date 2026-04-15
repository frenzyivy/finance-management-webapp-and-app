import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { PriorityLevel } from "../types/database";
import { PickerModal } from "../components/PickerModal";
import { PageHeader } from "../components/PageHeader";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii } from "../lib/radii";
import { formatINR } from "../components/komal";
import type { RootStackParamList } from "../navigation/AppNavigator";

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const COLOR_OPTIONS = ["#0D9373", "#F5A623", "#3B82F6", "#8B5CF6", "#EC4899", "#22C55E"];

const ICON_OPTIONS = [
  { value: "piggy-bank", label: "Piggy Bank" },
  { value: "shield", label: "Shield" },
  { value: "graduation-cap", label: "Graduation" },
  { value: "plane", label: "Travel" },
  { value: "home", label: "Home" },
  { value: "heart", label: "Heart" },
];

export function AddGoalScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, "AddGoal">>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const existingGoal = route.params?.goal;
  const isEditing = !!existingGoal;

  const [name, setName] = useState(existingGoal?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(existingGoal ? String(existingGoal.target_amount) : "");
  const [priority, setPriority] = useState<PriorityLevel>(existingGoal?.priority ?? "medium");
  const [deadline, setDeadline] = useState(existingGoal?.target_date ?? "");
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [selectedIcon, setSelectedIcon] = useState("piggy-bank");
  const [saving, setSaving] = useState(false);
  const [priorityPickerVisible, setPriorityPickerVisible] = useState(false);
  const [iconPickerVisible, setIconPickerVisible] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a goal name");
      return;
    }
    const amount = parseFloat(targetAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Required", "Please enter a valid target amount");
      return;
    }
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      Alert.alert("Invalid Date", "Please use YYYY-MM-DD format");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isEditing) {
        const { error } = await supabase.from("savings_goals").update({
          name: name.trim(),
          target_amount: amount,
          target_date: deadline || null,
          priority,
        }).eq("id", existingGoal!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("savings_goals").insert({
          user_id: user.id,
          name: name.trim(),
          target_amount: amount,
          current_balance: 0,
          target_date: deadline || null,
          status: "active",
          priority,
        });
        if (error) throw error;
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save goal");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    color: colors.textPrimary,
    fontFamily: fonts.sansMedium,
    fontSize: 14,
  } as const;

  const labelStyle = [typography.pillLabel, { color: colors.textTertiary, marginBottom: 6, marginTop: 16 }];

  const previewAmount = parseFloat(targetAmount);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageHeader
        title={isEditing ? "Edit Goal" : "New Goal"}
        actions={
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth={1.8} strokeLinecap="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </Pressable>
        }
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom, paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={labelStyle}>Goal Name *</Text>
        <TextInput
          style={inputStyle}
          placeholder="e.g. Emergency Fund"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
        />

        <Text style={labelStyle}>Target Amount *</Text>
        <TextInput
          style={inputStyle}
          placeholder="e.g. 100000"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          value={targetAmount}
          onChangeText={setTargetAmount}
        />
        {!!previewAmount && previewAmount > 0 && (
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
            {formatINR(previewAmount)}
          </Text>
        )}

        <Text style={labelStyle}>Priority</Text>
        <Pressable
          onPress={() => setPriorityPickerVisible(true)}
          style={({ pressed }) => [
            inputStyle,
            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: 14 }}>
            {PRIORITY_OPTIONS.find((p) => p.value === priority)?.label || "Select"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>▼</Text>
        </Pressable>

        <PickerModal
          visible={priorityPickerVisible}
          onClose={() => setPriorityPickerVisible(false)}
          options={PRIORITY_OPTIONS}
          selectedValue={priority}
          onSelect={(val) => {
            setPriority(val as PriorityLevel);
            setPriorityPickerVisible(false);
          }}
        />

        <Text style={labelStyle}>Target Date (optional)</Text>
        <TextInput
          style={inputStyle}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
          value={deadline}
          onChangeText={setDeadline}
        />

        <Text style={labelStyle}>Color</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
          {COLOR_OPTIONS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setSelectedColor(c)}
              style={({ pressed }) => [
                {
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: c,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  borderWidth: selectedColor === c ? 3 : 0,
                  borderColor: colors.textPrimary,
                },
              ]}
            />
          ))}
        </View>

        <Text style={labelStyle}>Icon</Text>
        <Pressable
          onPress={() => setIconPickerVisible(true)}
          style={({ pressed }) => [
            inputStyle,
            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: 14 }}>
            {ICON_OPTIONS.find((i) => i.value === selectedIcon)?.label || "Select"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>▼</Text>
        </Pressable>

        <PickerModal
          visible={iconPickerVisible}
          onClose={() => setIconPickerVisible(false)}
          options={ICON_OPTIONS}
          selectedValue={selectedIcon}
          onSelect={(val) => {
            setSelectedIcon(val);
            setIconPickerVisible(false);
          }}
        />

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: colors.accent,
              opacity: saving ? 0.6 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.saveBtnText, { fontFamily: fonts.sansSemibold }]}>
              {isEditing ? "Update Goal" : "Save Goal"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
