import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRoute, RouteProp } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { PriorityLevel } from "../types/database";
import { PickerModal } from "../components/PickerModal";
import type { RootStackParamList } from "../navigation/AppNavigator";

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const COLOR_OPTIONS = ["#0d9488", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#22c55e"];

const ICON_OPTIONS = [
  { value: "piggy-bank", label: "Piggy Bank" },
  { value: "shield", label: "Shield" },
  { value: "graduation-cap", label: "Graduation" },
  { value: "plane", label: "Travel" },
  { value: "home", label: "Home" },
  { value: "heart", label: "Heart" },
];

export function AddGoalScreen({ navigation }: any) {
  const route = useRoute<RouteProp<RootStackParamList, "AddGoal">>();
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Goal Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Emergency Fund"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Target Amount *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 100000"
        keyboardType="numeric"
        value={targetAmount}
        onChangeText={setTargetAmount}
      />

      <Text style={styles.label}>Priority</Text>
      <TouchableOpacity
        style={styles.pickerBtn}
        onPress={() => setPriorityPickerVisible(true)}
      >
        <Text style={styles.pickerBtnText}>
          {PRIORITY_OPTIONS.find((p) => p.value === priority)?.label || "Select"}
        </Text>
      </TouchableOpacity>

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

      <Text style={styles.label}>Target Date (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={deadline}
        onChangeText={setDeadline}
      />

      <Text style={styles.label}>Color</Text>
      <View style={styles.colorRow}>
        {COLOR_OPTIONS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[
              styles.colorCircle,
              { backgroundColor: c },
              selectedColor === c && styles.colorCircleSelected,
            ]}
            onPress={() => setSelectedColor(c)}
          />
        ))}
      </View>

      <Text style={styles.label}>Icon</Text>
      <TouchableOpacity
        style={styles.pickerBtn}
        onPress={() => setIconPickerVisible(true)}
      >
        <Text style={styles.pickerBtnText}>
          {ICON_OPTIONS.find((i) => i.value === selectedIcon)?.label || "Select"}
        </Text>
      </TouchableOpacity>

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

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>{isEditing ? "Update Goal" : "Save Goal"}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, paddingBottom: 40 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#1f2937",
  },
  pickerBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
  },
  pickerBtnText: { fontSize: 16, color: "#1f2937" },
  colorRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: "#1f2937",
  },
  saveBtn: {
    backgroundColor: "#0d9488",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
