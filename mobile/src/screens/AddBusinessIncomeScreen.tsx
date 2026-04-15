import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { PickerModal } from "../components/PickerModal";
import { PageHeader } from "../components/PageHeader";
import {
  BUSINESS_INCOME_CATEGORIES,
  LANDED_IN_OPTIONS,
} from "../lib/business-constants";
import { PAYMENT_METHODS, RECURRENCE_FREQUENCIES } from "../lib/constants";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii } from "../lib/radii";
import { formatINR } from "../components/komal";
import type { BusinessIncome, BusinessIncomeCategory, LandedIn } from "../types/business";
import type { PaymentMethod, RecurrenceFrequency } from "../types/database";
import type { BusinessClient } from "../types/business";

export function AddBusinessIncomeScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const existingEntry: BusinessIncome | undefined = route.params?.entry;
  const isEditing = !!existingEntry;
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState(existingEntry ? String(existingEntry.amount) : "");
  const [category, setCategory] = useState<BusinessIncomeCategory>(existingEntry?.category ?? "client_project");
  const [sourceName, setSourceName] = useState(existingEntry?.source_name ?? "");
  const [projectName, setProjectName] = useState(existingEntry?.project_name ?? "");
  const [clientId, setClientId] = useState<string | null>(existingEntry?.client_id ?? null);
  const [invoiceNumber, setInvoiceNumber] = useState(existingEntry?.invoice_number ?? "");
  const [date, setDate] = useState(existingEntry?.date ?? new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>((existingEntry?.payment_method as PaymentMethod) ?? "bank_transfer");
  const [landedIn, setLandedIn] = useState<LandedIn>(existingEntry?.landed_in ?? "personal_account");
  const [isRecurring, setIsRecurring] = useState(existingEntry?.is_recurring ?? false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>((existingEntry?.recurrence_frequency as RecurrenceFrequency) ?? "monthly");
  const [notes, setNotes] = useState(existingEntry?.notes ?? "");

  const [activeClients, setActiveClients] = useState<BusinessClient[]>([]);

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showLandedInPicker, setShowLandedInPicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);

  useEffect(() => {
    async function fetchClients() {
      const { data } = await supabase
        .from("business_clients")
        .select("*")
        .eq("status", "active")
        .order("name");
      if (data) setActiveClients(data as BusinessClient[]);
    }
    fetchClients();
  }, []);

  const getCategoryLabel = (val: string) =>
    BUSINESS_INCOME_CATEGORIES.find((c) => c.value === val)?.label ?? val;
  const getPaymentLabel = (val: string) =>
    PAYMENT_METHODS.find((p) => p.value === val)?.label ?? val;
  const getLandedInLabel = (val: string) =>
    LANDED_IN_OPTIONS.find((l) => l.value === val)?.label ?? val;
  const getFrequencyLabel = (val: string) =>
    RECURRENCE_FREQUENCIES.find((f) => f.value === val)?.label ?? val;

  const clientPickerOptions = activeClients.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount greater than 0.");
      return;
    }
    if (!sourceName.trim()) {
      Alert.alert("Validation Error", "Please enter a source name.");
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Validation Error", "Please enter a valid date in YYYY-MM-DD format.");
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
        amount: parsedAmount,
        category,
        source_name: sourceName.trim(),
        project_name: projectName.trim() || null,
        client_id: clientId || null,
        invoice_number: invoiceNumber.trim() || null,
        date,
        payment_method: paymentMethod,
        landed_in: landedIn,
        is_recurring: isRecurring,
        recurrence_frequency: isRecurring ? recurrenceFrequency : null,
        notes: notes.trim() || null,
      };

      const { error } = isEditing
        ? await supabase.from("business_income").update(payload).eq("id", existingEntry!.id)
        : await supabase.from("business_income").insert(payload);

      if (error) throw error;
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to save business income.");
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

  const previewAmount = parseFloat(amount);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <PageHeader
          title={isEditing ? "Edit Income" : "Business Income"}
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
          <Text style={labelStyle}>Amount *</Text>
          <TextInput
            style={inputStyle}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          {!!previewAmount && previewAmount > 0 && (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
              {formatINR(previewAmount)}
            </Text>
          )}

          <Text style={labelStyle}>Category *</Text>
          <PickerField colors={colors} onPress={() => setShowCategoryPicker(true)}>
            {getCategoryLabel(category)}
          </PickerField>

          <Text style={labelStyle}>Source Name *</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Client Name, Platform"
            placeholderTextColor={colors.textTertiary}
            value={sourceName}
            onChangeText={setSourceName}
          />

          <Text style={labelStyle}>Project Name</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Website Redesign"
            placeholderTextColor={colors.textTertiary}
            value={projectName}
            onChangeText={setProjectName}
          />

          <Text style={labelStyle}>Client (optional)</Text>
          {activeClients.length > 0 ? (
            <PickerField colors={colors} onPress={() => setShowClientPicker(true)} placeholder={!clientId}>
              {clientId
                ? clientPickerOptions.find((c) => c.value === clientId)?.label ?? "Select client"
                : "Select client"}
            </PickerField>
          ) : (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              No active clients found.
            </Text>
          )}

          <Text style={labelStyle}>Invoice Number</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. INV-001"
            placeholderTextColor={colors.textTertiary}
            value={invoiceNumber}
            onChangeText={setInvoiceNumber}
          />

          <Text style={labelStyle}>Date *</Text>
          <TextInput
            style={inputStyle}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            value={date}
            onChangeText={setDate}
          />

          <Text style={labelStyle}>Payment Method</Text>
          <PickerField colors={colors} onPress={() => setShowPaymentPicker(true)}>
            {getPaymentLabel(paymentMethod)}
          </PickerField>

          <Text style={labelStyle}>Landed In</Text>
          <PickerField colors={colors} onPress={() => setShowLandedInPicker(true)}>
            {getLandedInLabel(landedIn)}
          </PickerField>

          <View style={styles.switchRow}>
            <Text style={[typography.pillLabel, { color: colors.textTertiary }]}>Is Recurring</Text>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: colors.border, true: colors.accentLight }}
              thumbColor={isRecurring ? colors.accent : colors.surfaceAlt}
            />
          </View>

          {isRecurring && (
            <>
              <Text style={labelStyle}>Recurrence Frequency</Text>
              <PickerField colors={colors} onPress={() => setShowFrequencyPicker(true)}>
                {getFrequencyLabel(recurrenceFrequency)}
              </PickerField>
            </>
          )}

          <Text style={labelStyle}>Notes</Text>
          <TextInput
            style={[inputStyle, styles.textArea]}
            placeholder="Optional notes..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveButton,
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
              <Text style={[styles.saveButtonText, { fontFamily: fonts.sansSemibold }]}>
                {isEditing ? "Update Business Income" : "Save Business Income"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        options={BUSINESS_INCOME_CATEGORIES}
        selectedValue={category}
        onSelect={(val) => setCategory(val as BusinessIncomeCategory)}
        title="Select Category"
      />
      <PickerModal
        visible={showPaymentPicker}
        onClose={() => setShowPaymentPicker(false)}
        options={PAYMENT_METHODS}
        selectedValue={paymentMethod}
        onSelect={(val) => setPaymentMethod(val as PaymentMethod)}
        title="Select Payment Method"
      />
      <PickerModal
        visible={showLandedInPicker}
        onClose={() => setShowLandedInPicker(false)}
        options={LANDED_IN_OPTIONS}
        selectedValue={landedIn}
        onSelect={(val) => setLandedIn(val as LandedIn)}
        title="Where Did It Land?"
      />
      <PickerModal
        visible={showFrequencyPicker}
        onClose={() => setShowFrequencyPicker(false)}
        options={RECURRENCE_FREQUENCIES}
        selectedValue={recurrenceFrequency}
        onSelect={(val) => setRecurrenceFrequency(val as RecurrenceFrequency)}
        title="Select Frequency"
      />
      {clientPickerOptions.length > 0 && (
        <PickerModal
          visible={showClientPicker}
          onClose={() => setShowClientPicker(false)}
          options={clientPickerOptions}
          selectedValue={clientId ?? ""}
          onSelect={(val) => setClientId(val)}
          title="Select Client"
        />
      )}
    </View>
  );
}

function PickerField({
  colors,
  onPress,
  children,
  placeholder,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  onPress: () => void;
  children: React.ReactNode;
  placeholder?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 12,
          padding: 14,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          color: placeholder ? colors.textTertiary : colors.textPrimary,
          fontFamily: fonts.sansMedium,
          fontSize: 14,
          flex: 1,
          marginRight: 8,
        }}
      >
        {children}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>▼</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
