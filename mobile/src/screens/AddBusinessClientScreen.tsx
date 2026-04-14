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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { PickerModal } from "../components/PickerModal";
import {
  CLIENT_STATUSES,
  ENGAGEMENT_TYPES,
} from "../lib/business-constants";
import type {
  BusinessClient,
  ClientStatus,
  EngagementType,
} from "../types/business";

export function AddBusinessClientScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const existingEntry: BusinessClient | undefined = route.params?.entry;
  const isEditing = !!existingEntry;
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(existingEntry?.name ?? "");
  const [industry, setIndustry] = useState(existingEntry?.industry ?? "");
  const [country, setCountry] = useState(existingEntry?.country ?? "");
  const [contactName, setContactName] = useState(existingEntry?.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(existingEntry?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(existingEntry?.contact_phone ?? "");
  const [engagementType, setEngagementType] = useState<EngagementType | "">(
    existingEntry?.engagement_type ?? ""
  );
  const [monthlyValue, setMonthlyValue] = useState(
    existingEntry?.monthly_value != null ? String(existingEntry.monthly_value) : ""
  );
  const [startDate, setStartDate] = useState(existingEntry?.start_date ?? "");
  const [status, setStatus] = useState<ClientStatus>(existingEntry?.status ?? "active");
  const [notes, setNotes] = useState(existingEntry?.notes ?? "");

  const [showEngagementPicker, setShowEngagementPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const getEngagementLabel = (val: string) =>
    ENGAGEMENT_TYPES.find((e) => e.value === val)?.label ?? val;
  const getStatusLabel = (val: string) =>
    CLIENT_STATUSES.find((s) => s.value === val)?.label ?? val;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Validation Error", "Please enter a client name.");
      return;
    }
    if (contactEmail.trim() && !contactEmail.includes("@")) {
      Alert.alert("Validation Error", "Please enter a valid email address.");
      return;
    }
    if (startDate && !startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Validation Error", "Start date must be in YYYY-MM-DD format.");
      return;
    }

    const parsedMonthly = monthlyValue.trim() ? parseFloat(monthlyValue) : null;
    if (parsedMonthly !== null && (isNaN(parsedMonthly) || parsedMonthly < 0)) {
      Alert.alert("Validation Error", "Monthly value must be 0 or greater.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in.");
        return;
      }

      const payload = {
        user_id: user.id,
        name: name.trim(),
        industry: industry.trim() || null,
        country: country.trim() || null,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        engagement_type: engagementType || null,
        monthly_value: parsedMonthly,
        start_date: startDate || null,
        status,
        notes: notes.trim() || null,
      };

      const { error } = isEditing
        ? await supabase.from("business_clients").update(payload).eq("id", existingEntry!.id)
        : await supabase.from("business_clients").insert(payload);

      if (error) throw error;
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to save client.");
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
        <Text style={styles.label}>Client / Business Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Dr. Singh Dental Clinic"
          placeholderTextColor="#9ca3af"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Industry</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Dental, SaaS"
          placeholderTextColor="#9ca3af"
          value={industry}
          onChangeText={setIndustry}
        />

        <Text style={styles.label}>Country</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. India, Germany"
          placeholderTextColor="#9ca3af"
          value={country}
          onChangeText={setCountry}
        />

        <Text style={styles.label}>Contact Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#9ca3af"
          value={contactName}
          onChangeText={setContactName}
        />

        <Text style={styles.label}>Contact Email</Text>
        <TextInput
          style={styles.input}
          placeholder="email@example.com"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
          value={contactEmail}
          onChangeText={setContactEmail}
        />

        <Text style={styles.label}>Contact Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="+91 98765 43210"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          value={contactPhone}
          onChangeText={setContactPhone}
        />

        <Text style={styles.label}>Engagement Type</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowEngagementPicker(true)}
        >
          <Text style={styles.pickerButtonText}>
            {engagementType ? getEngagementLabel(engagementType) : "Select engagement type"}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Status</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowStatusPicker(true)}
        >
          <Text style={styles.pickerButtonText}>{getStatusLabel(status)}</Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Monthly Value (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={monthlyValue}
          onChangeText={setMonthlyValue}
        />

        <Text style={styles.label}>Start Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9ca3af"
          value={startDate}
          onChangeText={setStartDate}
        />

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
              {isEditing ? "Update Client" : "Save Client"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <PickerModal
        visible={showEngagementPicker}
        onClose={() => setShowEngagementPicker(false)}
        options={ENGAGEMENT_TYPES as unknown as { value: string; label: string }[]}
        selectedValue={engagementType}
        onSelect={(val) => setEngagementType(val as EngagementType)}
        title="Select Engagement Type"
      />
      <PickerModal
        visible={showStatusPicker}
        onClose={() => setShowStatusPicker(false)}
        options={CLIENT_STATUSES as unknown as { value: string; label: string }[]}
        selectedValue={status}
        onSelect={(val) => setStatus(val as ClientStatus)}
        title="Select Status"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
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