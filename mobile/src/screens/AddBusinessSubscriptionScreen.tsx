import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { PickerModal } from "../components/PickerModal";
import {
  SUBSCRIPTION_CATEGORIES,
  BILLING_CYCLES,
  SUBSCRIPTION_STATUSES,
  FUNDED_FROM_OPTIONS,
} from "../lib/business-constants";
import type {
  BusinessSubscription,
  SubscriptionCategory,
  BillingCycle,
  SubscriptionStatus,
  FundedFrom,
} from "../types/business";

export function AddBusinessSubscriptionScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const existingEntry: BusinessSubscription | undefined = route.params?.entry;
  const isEditing = !!existingEntry;
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(existingEntry?.name ?? "");
  const [category, setCategory] = useState<SubscriptionCategory>(existingEntry?.category ?? "ai_tools");
  const [vendorUrl, setVendorUrl] = useState(existingEntry?.vendor_url ?? "");
  const [costAmount, setCostAmount] = useState(existingEntry ? String(existingEntry.cost_amount) : "");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(existingEntry?.billing_cycle ?? "monthly");
  const [renewalDay, setRenewalDay] = useState(existingEntry ? String(existingEntry.renewal_day) : "1");
  const [nextRenewalDate, setNextRenewalDate] = useState(existingEntry?.next_renewal_date ?? new Date().toISOString().split("T")[0]);
  const [startDate, setStartDate] = useState(existingEntry?.start_date ?? new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState<SubscriptionStatus>(existingEntry?.status ?? "active");
  const [fundedFrom, setFundedFrom] = useState<FundedFrom>(existingEntry?.funded_from ?? "personal_pocket");
  const [isEssential, setIsEssential] = useState(existingEntry?.is_essential ?? false);
  const [autoRenew, setAutoRenew] = useState(existingEntry?.auto_renew ?? true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(existingEntry ? String(existingEntry.reminder_days_before) : "3");
  const [notes, setNotes] = useState(existingEntry?.notes ?? "");

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showBillingCyclePicker, setShowBillingCyclePicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showFundedFromPicker, setShowFundedFromPicker] = useState(false);

  const getCategoryLabel = (val: string) =>
    SUBSCRIPTION_CATEGORIES.find((c) => c.value === val)?.label ?? val;
  const getBillingCycleLabel = (val: string) =>
    BILLING_CYCLES.find((c) => c.value === val)?.label ?? val;
  const getStatusLabel = (val: string) =>
    SUBSCRIPTION_STATUSES.find((s) => s.value === val)?.label ?? val;
  const getFundedFromLabel = (val: string) =>
    FUNDED_FROM_OPTIONS.find((f) => f.value === val)?.label ?? val;

  const handleSave = async () => {
    const parsedCost = parseFloat(costAmount);
    if (!parsedCost || parsedCost <= 0) {
      Alert.alert("Validation Error", "Please enter a valid cost greater than 0.");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Validation Error", "Please enter a subscription name.");
      return;
    }
    if (!nextRenewalDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Validation Error", "Please enter a valid next renewal date in YYYY-MM-DD format.");
      return;
    }
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Validation Error", "Please enter a valid start date in YYYY-MM-DD format.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in.");
        return;
      }

      // DO NOT include monthly_equivalent — it's a GENERATED column
      const payload = {
        user_id: user.id,
        name: name.trim(),
        category,
        vendor_url: vendorUrl.trim() || null,
        cost_amount: parsedCost,
        billing_cycle: billingCycle,
        renewal_day: parseInt(renewalDay) || 1,
        next_renewal_date: nextRenewalDate,
        start_date: startDate,
        status,
        funded_from: fundedFrom,
        is_essential: isEssential,
        auto_renew: autoRenew,
        reminder_days_before: parseInt(reminderDaysBefore) || 3,
        notes: notes.trim() || null,
      };

      const { error } = isEditing
        ? await supabase.from("business_subscriptions").update(payload).eq("id", existingEntry!.id)
        : await supabase.from("business_subscriptions").insert(payload);

      if (error) throw error;
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to save subscription.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <Text style={styles.label}>Subscription Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. ChatGPT Plus, Vercel Pro"
          placeholderTextColor="#9ca3af"
          value={name}
          onChangeText={setName}
        />

        {/* Category */}
        <Text style={styles.label}>Category *</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowCategoryPicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {getCategoryLabel(category)}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Vendor URL */}
        <Text style={styles.label}>Vendor URL</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. https://openai.com"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="url"
          value={vendorUrl}
          onChangeText={setVendorUrl}
        />

        {/* Cost Amount */}
        <Text style={styles.label}>Cost Amount *</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={costAmount}
          onChangeText={setCostAmount}
        />

        {/* Billing Cycle */}
        <Text style={styles.label}>Billing Cycle *</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowBillingCyclePicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {getBillingCycleLabel(billingCycle)}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Renewal Day */}
        <Text style={styles.label}>Renewal Day of Month</Text>
        <TextInput
          style={styles.input}
          placeholder="1-31"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={renewalDay}
          onChangeText={setRenewalDay}
        />

        {/* Next Renewal Date */}
        <Text style={styles.label}>Next Renewal Date *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9ca3af"
          value={nextRenewalDate}
          onChangeText={setNextRenewalDate}
        />

        {/* Start Date */}
        <Text style={styles.label}>Start Date *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9ca3af"
          value={startDate}
          onChangeText={setStartDate}
        />

        {/* Status */}
        <Text style={styles.label}>Status</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowStatusPicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {getStatusLabel(status)}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Funded From */}
        <Text style={styles.label}>Funded From</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowFundedFromPicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {getFundedFromLabel(fundedFrom)}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Is Essential */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>Essential</Text>
          <Switch
            value={isEssential}
            onValueChange={setIsEssential}
            trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
            thumbColor={isEssential ? "#185FA5" : "#f4f4f5"}
          />
        </View>

        {/* Auto Renew */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>Auto Renew</Text>
          <Switch
            value={autoRenew}
            onValueChange={setAutoRenew}
            trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
            thumbColor={autoRenew ? "#185FA5" : "#f4f4f5"}
          />
        </View>

        {/* Reminder Days Before */}
        <Text style={styles.label}>Reminder Days Before Renewal</Text>
        <TextInput
          style={styles.input}
          placeholder="3"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={reminderDaysBefore}
          onChangeText={setReminderDaysBefore}
        />

        {/* Notes */}
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Optional notes..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
        />

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEditing ? "Update Subscription" : "Save Subscription"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Picker Modals */}
      <PickerModal
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        options={SUBSCRIPTION_CATEGORIES}
        selectedValue={category}
        onSelect={(val) => setCategory(val as SubscriptionCategory)}
        title="Select Category"
      />
      <PickerModal
        visible={showBillingCyclePicker}
        onClose={() => setShowBillingCyclePicker(false)}
        options={BILLING_CYCLES}
        selectedValue={billingCycle}
        onSelect={(val) => setBillingCycle(val as BillingCycle)}
        title="Select Billing Cycle"
      />
      <PickerModal
        visible={showStatusPicker}
        onClose={() => setShowStatusPicker(false)}
        options={SUBSCRIPTION_STATUSES}
        selectedValue={status}
        onSelect={(val) => setStatus(val as SubscriptionStatus)}
        title="Select Status"
      />
      <PickerModal
        visible={showFundedFromPicker}
        onClose={() => setShowFundedFromPicker(false)}
        options={FUNDED_FROM_OPTIONS}
        selectedValue={fundedFrom}
        onSelect={(val) => setFundedFrom(val as FundedFrom)}
        title="Funded From"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
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
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "#f9fafb",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f9fafb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerButtonText: {
    fontSize: 16,
    color: "#1f2937",
  },
  pickerArrow: {
    fontSize: 12,
    color: "#6b7280",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  saveButton: {
    backgroundColor: "#185FA5",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
