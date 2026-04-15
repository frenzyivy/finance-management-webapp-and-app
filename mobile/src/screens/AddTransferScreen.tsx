import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { PickerModal } from "../components/PickerModal";
import { PageHeader } from "../components/PageHeader";
import { formatCurrency } from "../lib/format";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii } from "../lib/radii";
import { formatINR } from "../components/komal";
import type {
  BusinessExpense,
  BusinessIncome,
  TransferDirection,
} from "../types/business";

const DIRECTION_OPTIONS = [
  { value: "personal_to_business", label: "Personal → Business" },
  { value: "business_to_personal", label: "Business → Personal" },
];

export function AddTransferScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  const [direction, setDirection] = useState<TransferDirection>("personal_to_business");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [linkedExpenseId, setLinkedExpenseId] = useState<string | null>(null);
  const [linkedIncomeId, setLinkedIncomeId] = useState<string | null>(null);

  const [businessExpenses, setBusinessExpenses] = useState<BusinessExpense[]>([]);
  const [businessIncome, setBusinessIncome] = useState<BusinessIncome[]>([]);

  const [showDirectionPicker, setShowDirectionPicker] = useState(false);
  const [showExpensePicker, setShowExpensePicker] = useState(false);
  const [showIncomePicker, setShowIncomePicker] = useState(false);

  useEffect(() => {
    async function fetchRelated() {
      const now = new Date();
      const sixtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60)
        .toISOString()
        .split("T")[0];
      const [expRes, incRes] = await Promise.all([
        supabase
          .from("business_expenses")
          .select("*")
          .gte("date", sixtyDaysAgo)
          .order("date", { ascending: false })
          .limit(50),
        supabase
          .from("business_income")
          .select("*")
          .gte("date", sixtyDaysAgo)
          .order("date", { ascending: false })
          .limit(50),
      ]);
      if (expRes.data) setBusinessExpenses(expRes.data as BusinessExpense[]);
      if (incRes.data) setBusinessIncome(incRes.data as BusinessIncome[]);
    }
    fetchRelated();
  }, []);

  const getDirectionLabel = (val: string) =>
    DIRECTION_OPTIONS.find((d) => d.value === val)?.label ?? val;

  const expenseOptions = [
    { value: "", label: "— None —" },
    ...businessExpenses.map((e) => ({
      value: e.id,
      label: `${e.vendor_name} — ${formatCurrency(e.amount)} (${e.date})`,
    })),
  ];

  const incomeOptions = [
    { value: "", label: "— None —" },
    ...businessIncome.map((i) => ({
      value: i.id,
      label: `${i.source_name} — ${formatCurrency(i.amount)} (${i.date})`,
    })),
  ];

  const getExpenseLabel = (val: string) =>
    expenseOptions.find((o) => o.value === val)?.label ?? "— None —";
  const getIncomeLabel = (val: string) =>
    incomeOptions.find((o) => o.value === val)?.label ?? "— None —";

  const handleSave = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount greater than 0.");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Validation Error", "Please enter a reason.");
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Validation Error", "Date must be YYYY-MM-DD.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in.");
        return;
      }

      const { error } = await supabase.rpc("log_personal_business_transfer", {
        p_user_id: user.id,
        p_direction: direction,
        p_amount: parsed,
        p_date: date,
        p_reason: reason.trim(),
        p_business_expense_id:
          direction === "personal_to_business" ? linkedExpenseId || null : null,
        p_business_income_id:
          direction === "business_to_personal" ? linkedIncomeId || null : null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to log transfer");
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
          title="Log Transfer"
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
          <Text style={labelStyle}>Direction *</Text>
          <PickerField colors={colors} onPress={() => setShowDirectionPicker(true)}>
            {getDirectionLabel(direction)}
          </PickerField>

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

          <Text style={labelStyle}>Date *</Text>
          <TextInput
            style={inputStyle}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            value={date}
            onChangeText={setDate}
          />

          <Text style={labelStyle}>Reason *</Text>
          <TextInput
            style={inputStyle}
            placeholder={
              direction === "personal_to_business"
                ? "e.g. Paid for VPS hosting"
                : "e.g. Client payment withdrawal"
            }
            placeholderTextColor={colors.textTertiary}
            value={reason}
            onChangeText={setReason}
          />

          {direction === "personal_to_business" && (
            <>
              <Text style={labelStyle}>Link to business expense (optional)</Text>
              <PickerField colors={colors} onPress={() => setShowExpensePicker(true)}>
                {getExpenseLabel(linkedExpenseId ?? "")}
              </PickerField>
            </>
          )}

          {direction === "business_to_personal" && (
            <>
              <Text style={labelStyle}>Link to business income (optional)</Text>
              <PickerField colors={colors} onPress={() => setShowIncomePicker(true)}>
                {getIncomeLabel(linkedIncomeId ?? "")}
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
              <Text style={[styles.saveButtonText, { fontFamily: fonts.sansSemibold }]}>Log Transfer</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal
        visible={showDirectionPicker}
        onClose={() => setShowDirectionPicker(false)}
        options={DIRECTION_OPTIONS}
        selectedValue={direction}
        onSelect={(val) => {
          setDirection(val as TransferDirection);
          setLinkedExpenseId(null);
          setLinkedIncomeId(null);
        }}
        title="Select Direction"
      />
      <PickerModal
        visible={showExpensePicker}
        onClose={() => setShowExpensePicker(false)}
        options={expenseOptions}
        selectedValue={linkedExpenseId ?? ""}
        onSelect={(val) => setLinkedExpenseId(val || null)}
        title="Link to Business Expense"
      />
      <PickerModal
        visible={showIncomePicker}
        onClose={() => setShowIncomePicker(false)}
        options={incomeOptions}
        selectedValue={linkedIncomeId ?? ""}
        onSelect={(val) => setLinkedIncomeId(val || null)}
        title="Link to Business Income"
      />
    </View>
  );
}

function PickerField({
  colors,
  onPress,
  children,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  onPress: () => void;
  children: React.ReactNode;
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
          color: colors.textPrimary,
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
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
