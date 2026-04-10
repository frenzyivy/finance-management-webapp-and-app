import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../lib/supabase";

export function SettingsScreen() {
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, currency")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserName(profile.full_name || "");
      }
    } catch (err) {
      // Silently fail - profile may not exist yet
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [incomes, expenses, goals, debts] = await Promise.all([
        supabase.from("income_entries").select("id").eq("user_id", user.id),
        supabase.from("expense_entries").select("id").eq("user_id", user.id),
        supabase.from("savings_goals").select("id").eq("user_id", user.id),
        supabase.from("debts").select("id").eq("user_id", user.id),
      ]);

      Alert.alert(
        "Your Data Summary",
        `Income entries: ${incomes.data?.length || 0}\n` +
        `Expense entries: ${expenses.data?.length || 0}\n` +
        `Savings goals: ${goals.data?.length || 0}\n` +
        `Debts tracked: ${debts.data?.length || 0}`,
        [{ text: "OK" }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to export data");
    }
  };

  const handleChangePassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail);
      if (error) throw error;
      Alert.alert("Success", "Password reset email sent. Check your inbox.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send reset email");
    }
  };

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete all your data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              // Delete all user data from all tables
              await Promise.all([
                supabase.from("savings_contributions").delete().eq("user_id", user.id),
                supabase.from("debt_payments").delete().eq("user_id", user.id),
              ]);

              await Promise.all([
                supabase.from("income_entries").delete().eq("user_id", user.id),
                supabase.from("expense_entries").delete().eq("user_id", user.id),
                supabase.from("savings_goals").delete().eq("user_id", user.id),
                supabase.from("debts").delete().eq("user_id", user.id),
                supabase.from("budget_limits").delete().eq("user_id", user.id),
                supabase.from("credit_cards").delete().eq("user_id", user.id),
                supabase.from("profiles").delete().eq("id", user.id),
              ]);

              await supabase.auth.signOut();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete account");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Section */}
      <Text style={styles.sectionHeader}>Profile</Text>
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(userName || userEmail || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName || "User"}</Text>
            <Text style={styles.profileEmail}>{userEmail}</Text>
            <Text style={styles.profileCurrency}>Currency: INR</Text>
          </View>
        </View>
      </View>

      {/* Actions Section */}
      <Text style={styles.sectionHeader}>Actions</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.actionItem} onPress={handleExportData}>
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionText}>Export Data</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionItem} onPress={handleChangePassword}>
          <Text style={styles.actionIcon}>🔑</Text>
          <Text style={styles.actionText}>Change Password</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
          <Text style={styles.actionIcon}>🚪</Text>
          <Text style={styles.actionText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <Text style={[styles.sectionHeader, { color: "#f87171" }]}>Danger Zone</Text>
      <View style={[styles.card, { borderColor: "#fca5a5", borderWidth: 1 }]}>
        <Text style={styles.dangerDesc}>
          Permanently delete your account and all associated data. This cannot be undone.
        </Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0d9488",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: "bold", color: "#1f2937" },
  profileEmail: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  profileCurrency: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  actionIcon: { fontSize: 20, marginRight: 12 },
  actionText: { fontSize: 16, color: "#1f2937" },
  divider: { height: 1, backgroundColor: "#e5e7eb" },
  dangerDesc: { fontSize: 14, color: "#6b7280", marginBottom: 12 },
  deleteBtn: {
    backgroundColor: "#f87171",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
