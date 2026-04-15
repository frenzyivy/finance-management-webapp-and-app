import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme-context";
import { text as typography, fonts } from "../lib/typography";
import { radii, navHeight } from "../lib/radii";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageHeader } from "../components/PageHeader";
import { formatINR, TransactionCard } from "../components/komal";

/**
 * CC Statement Upload — mobile equivalent of the web statement upload dialog.
 *
 * Step 1: Pick statement PDF
 * Step 2: Parse via backend (Claude Vision / pdfplumber)
 * Step 3: Review summary + transactions
 * Step 4: Save statement + transactions
 */

interface ParsedCCTransaction {
  transaction_date: string | null;
  posting_date: string | null;
  description: string | null;
  reference: string | null;
  merchant_name: string | null;
  amount: number | null;
  transaction_type: string;
  category: string | null;
}

interface ParsedCCStatement {
  card_last_four: string | null;
  statement_date: string | null;
  due_date: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  total_amount_due: number | null;
  minimum_amount_due: number | null;
  previous_balance: number | null;
  payments_received: number | null;
  new_charges: number | null;
  interest_charged: number | null;
  fees_charged: number | null;
  credit_limit: number | null;
  available_credit: number | null;
  transactions: ParsedCCTransaction[];
  confidence: Record<string, string>;
  warnings: string[];
}

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export function CCStatementUploadScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const creditCardId = route?.params?.creditCardId;
  const cardName = route?.params?.cardName || "Credit Card";

  const [file, setFile] = useState<PickedFile | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedCCStatement | null>(null);
  const [selectedTxns, setSelectedTxns] = useState<Set<number>>(new Set());

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert("Too Large", "File must be under 10 MB.");
        return;
      }

      setFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || "application/pdf",
        size: asset.size || 0,
      });
      setParsedData(null);
      setSelectedTxns(new Set());
    } catch {
      Alert.alert("Error", "Could not pick file.");
    }
  };

  const parseStatement = async () => {
    if (!file) return;
    setParsing(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Error", "Not authenticated.");
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
      const formData = new FormData();
      formData.append("statement_file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      } as any);

      const res = await fetch(`${apiUrl}/api/cc/parse-statement`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        Alert.alert("Parse Failed", body.detail || `Error ${res.status}`);
        return;
      }

      const json = await res.json();
      const data = json.data as ParsedCCStatement;
      setParsedData(data);

      // Auto-select purchases and EMI charges
      const autoSelect = new Set<number>();
      (data.transactions || []).forEach((t, i) => {
        if (
          t.transaction_type === "purchase" ||
          t.transaction_type === "emi_charge"
        ) {
          autoSelect.add(i);
        }
      });
      setSelectedTxns(autoSelect);

      if (data.warnings?.length > 0) {
        Alert.alert("Parsed with warnings", data.warnings[0]);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Parse failed.");
    } finally {
      setParsing(false);
    }
  };

  const saveStatement = async () => {
    if (!parsedData || !creditCardId) return;
    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Error", "Not authenticated.");
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

      const transactions = (parsedData.transactions || [])
        .filter((t) => t.description && t.amount !== null && t.transaction_date)
        .map((t) => ({
          transaction_date: t.transaction_date!,
          posting_date: t.posting_date,
          description: t.description!,
          reference: t.reference,
          merchant_name: t.merchant_name,
          amount: t.amount!,
          transaction_type: t.transaction_type,
          category: t.category,
        }));

      const res = await fetch(`${apiUrl}/api/cc/statements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credit_card_id: creditCardId,
          statement_date:
            parsedData.statement_date || new Date().toISOString().split("T")[0],
          due_date:
            parsedData.due_date || new Date().toISOString().split("T")[0],
          billing_period_start: parsedData.billing_period_start,
          billing_period_end: parsedData.billing_period_end,
          total_amount_due: parsedData.total_amount_due || 0,
          minimum_amount_due: parsedData.minimum_amount_due || 0,
          previous_balance: parsedData.previous_balance || 0,
          payments_received: parsedData.payments_received || 0,
          new_charges: parsedData.new_charges || 0,
          interest_charged: parsedData.interest_charged || 0,
          fees_charged: parsedData.fees_charged || 0,
          credit_limit: parsedData.credit_limit,
          available_credit: parsedData.available_credit,
          transactions,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        Alert.alert("Save Failed", body.detail || `Error ${res.status}`);
        return;
      }

      const json = await res.json();
      Alert.alert(
        "Saved",
        `Statement saved with ${json.data?.transactions_count || 0} transactions.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const toggleTxn = (index: number) => {
    setSelectedTxns((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const cardBoxStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageHeader title="CC Statement" eyebrow="Upload PDF" />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: navHeight + 40 + insets.bottom,
          paddingHorizontal: 24,
        }}
      >
        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary, marginBottom: 20, lineHeight: 18 },
          ]}
        >
          Upload your {cardName} statement PDF and we&apos;ll extract all
          transactions. Nothing is stored until you approve.
        </Text>

        {/* File Picker */}
        {!parsedData && (
          <View style={{ marginBottom: 16 }}>
            <Pressable
              onPress={pickFile}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingVertical: 24,
                  paddingHorizontal: 16,
                  alignItems: "center",
                  marginBottom: 12,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary },
                ]}
              >
                {file ? `📄 ${file.name}` : "📂 Pick Statement PDF"}
              </Text>
              {file && (
                <Text
                  style={[
                    typography.captionRegular,
                    { color: colors.textTertiary, marginTop: 4 },
                  ]}
                >
                  {(file.size / 1024).toFixed(1)} KB
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={parseStatement}
              disabled={!file || parsing}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.accent,
                  borderRadius: 100,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: !file || parsing ? 0.5 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              {parsing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text
                  style={{
                    color: "#fff",
                    fontFamily: fonts.sansSemibold,
                    fontSize: 15,
                  }}
                >
                  ✨ Parse Statement
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Statement Summary */}
        {parsedData && (
          <View style={[cardBoxStyle, { marginBottom: 16 }]}>
            <Text
              style={[
                typography.sectionTitle,
                { color: colors.textPrimary, marginBottom: 10 },
              ]}
            >
              Statement Summary
            </Text>

            <SummaryRow
              label="Statement Date"
              value={parsedData.statement_date || "—"}
              colors={colors}
            />
            <SummaryRow
              label="Due Date"
              value={parsedData.due_date || "—"}
              colors={colors}
            />
            <SummaryRow
              label="Total Due"
              value={
                parsedData.total_amount_due != null
                  ? formatINR(parsedData.total_amount_due)
                  : "—"
              }
              valueColor={colors.expense}
              bold
              colors={colors}
            />
            <SummaryRow
              label="Minimum Due"
              value={
                parsedData.minimum_amount_due != null
                  ? formatINR(parsedData.minimum_amount_due)
                  : "—"
              }
              colors={colors}
            />
            {parsedData.credit_limit != null && (
              <SummaryRow
                label="Credit Limit"
                value={formatINR(parsedData.credit_limit)}
                colors={colors}
              />
            )}
            {(parsedData.interest_charged ?? 0) > 0 && (
              <SummaryRow
                label="Interest"
                value={formatINR(parsedData.interest_charged!)}
                valueColor={colors.expense}
                colors={colors}
              />
            )}
          </View>
        )}

        {/* Transactions */}
        {parsedData && (parsedData.transactions || []).length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={[
                typography.sectionTitle,
                { color: colors.textPrimary, marginBottom: 10 },
              ]}
            >
              Transactions ({parsedData.transactions.length})
            </Text>

            {parsedData.transactions.map((txn, index) => {
              const selected = selectedTxns.has(index);
              const isCredit =
                txn.transaction_type === "payment" ||
                txn.transaction_type === "refund" ||
                txn.transaction_type === "cashback";
              return (
                <Pressable
                  key={index}
                  onPress={() => toggleTxn(index)}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: selected
                        ? colors.accentLight
                        : colors.surface,
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 6,
                      borderWidth: 1,
                      borderColor: selected ? colors.accent : colors.border,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 2,
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: colors.surfaceAlt,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.sansSemibold,
                            fontSize: 9,
                            color: colors.textSecondary,
                          }}
                        >
                          {txn.transaction_type.toUpperCase()}
                        </Text>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[
                          typography.caption,
                          { color: colors.textPrimary, flex: 1 },
                        ]}
                      >
                        {txn.merchant_name || txn.description || "Unknown"}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 11,
                        color: colors.textTertiary,
                      }}
                    >
                      {txn.transaction_date}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: fonts.sansSemibold,
                      fontSize: 13,
                      color: isCredit ? colors.income : colors.expense,
                    }}
                  >
                    {txn.amount != null
                      ? formatINR(Math.abs(txn.amount))
                      : "—"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Save Button */}
        {parsedData && (
          <Pressable
            onPress={saveStatement}
            disabled={saving}
            style={({ pressed }) => [
              {
                backgroundColor: colors.accent,
                borderRadius: 100,
                paddingVertical: 14,
                alignItems: "center",
                opacity: saving ? 0.5 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text
                style={{
                  color: "#fff",
                  fontFamily: fonts.sansSemibold,
                  fontSize: 15,
                }}
              >
                Save Statement ({parsedData.transactions?.length || 0}{" "}
                transactions)
              </Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  valueColor,
  bold,
  colors,
}: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
  colors: any;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 5,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.sans,
          fontSize: 13,
          color: colors.textSecondary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: bold ? fonts.sansBold : fonts.sansMedium,
          fontSize: 13,
          color: valueColor || colors.textPrimary,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
