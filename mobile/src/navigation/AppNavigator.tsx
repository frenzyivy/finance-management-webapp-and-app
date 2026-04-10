import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabs } from "./MainTabs";

export function AppNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <NavigationContainer>
      {session ? <MainTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
