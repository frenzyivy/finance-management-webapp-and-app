import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../lib/supabase";

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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  purchase: "#ef4444",
  refund: "#22c55e",
  fee: "#f59e0b",
  interest: "#f59e0b",
  payment: "#22c55e",
  cashback: "#22c55e",
  emi_charge: "#8b5cf6",
};

export function CCStatementUploadScreen({ navigation, route }: any) {
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
      const { data: { session } } = await supabase.auth.getSession();
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
        if (t.transaction_type === "purchase" || t.transaction_type === "emi_charge") {
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
      const { data: { session } } = await supabase.auth.getSession();
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
          statement_date: parsedData.statement_date || new Date().toISOString().split("T")[0],
          due_date: parsedData.due_date || new Date().toISOString().split("T")[0],
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

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Upload {cardName} Statement</Text>
      <Text style={styles.subtitle}>
        Upload your credit card statement PDF and we&apos;ll extract all transactions.
        Nothing is stored until you approve.
      </Text>

      {/* File Picker */}
      {!parsedData && (
        <View style={styles.section}>
          <TouchableOpacity style={styles.pickButton} onPress={pickFile}>
            <Text style={styles.pickButtonText}>
              {file ? `📄 ${file.name}` : "📂 Pick Statement PDF"}
            </Text>
            {file && (
              <Text style={styles.fileSize}>
                {(file.size / 1024).toFixed(1)} KB
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.parseButton, (!file || parsing) && styles.disabledButton]}
            onPress={parseStatement}
            disabled={!file || parsing}
          >
            {parsing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.parseButtonText}>✨ Parse Statement</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Statement Summary */}
      {parsedData && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Statement Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Statement Date</Text>
            <Text style={styles.summaryValue}>{parsedData.statement_date || "—"}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Due Date</Text>
            <Text style={styles.summaryValue}>{parsedData.due_date || "—"}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Due</Text>
            <Text style={[styles.summaryValue, { color: "#ef4444", fontWeight: "700" }]}>
              {parsedData.total_amount_due != null
                ? formatCurrency(parsedData.total_amount_due)
                : "—"}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Minimum Due</Text>
            <Text style={styles.summaryValue}>
              {parsedData.minimum_amount_due != null
                ? formatCurrency(parsedData.minimum_amount_due)
                : "—"}
            </Text>
          </View>
          {parsedData.credit_limit != null && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Credit Limit</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(parsedData.credit_limit)}
              </Text>
            </View>
          )}
          {(parsedData.interest_charged ?? 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Interest</Text>
              <Text style={[styles.summaryValue, { color: "#ef4444" }]}>
                {formatCurrency(parsedData.interest_charged!)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Transactions */}
      {parsedData && (parsedData.transactions || []).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Transactions ({parsedData.transactions.length})
          </Text>

          {parsedData.transactions.map((txn, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.txnRow,
                selectedTxns.has(index) && styles.txnRowSelected,
              ]}
              onPress={() => toggleTxn(index)}
            >
              <View style={styles.txnLeft}>
                <View style={styles.txnHeader}>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          (TRANSACTION_TYPE_COLORS[txn.transaction_type] || "#6b7280") + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        {
                          color: TRANSACTION_TYPE_COLORS[txn.transaction_type] || "#6b7280",
                        },
                      ]}
                    >
                      {txn.transaction_type.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.txnMerchant} numberOfLines={1}>
                    {txn.merchant_name || txn.description || "Unknown"}
                  </Text>
                </View>
                <Text style={styles.txnDate}>{txn.transaction_date}</Text>
              </View>
              <Text
                style={[
                  styles.txnAmount,
                  { color: (txn.amount || 0) < 0 ? "#22c55e" : "#ef4444" },
                ]}
              >
                {txn.amount != null
                  ? formatCurrency(Math.abs(txn.amount))
                  : "—"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Save Button */}
      {parsedData && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabledButton]}
            onPress={saveStatement}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>
                Save Statement ({parsedData.transactions?.length || 0} transactions)
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 16,
    lineHeight: 18,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  pickButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  pickButtonText: {
    fontSize: 14,
    color: "#6b7280",
  },
  fileSize: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 4,
  },
  parseButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  parseButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#6b7280",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "500",
    color: "#111827",
  },
  txnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  txnRowSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  txnLeft: {
    flex: 1,
    marginRight: 8,
  },
  txnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  typeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "600",
  },
  txnMerchant: {
    fontSize: 13,
    fontWeight: "500",
    color: "#111827",
    flex: 1,
  },
  txnDate: {
    fontSize: 11,
    color: "#9ca3af",
  },
  txnAmount: {
    fontSize: 13,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#059669",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
