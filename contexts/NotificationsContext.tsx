import React, { createContext, useContext, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const NotificationsContext = createContext<{
  expoPushToken: string | null;
}>({ expoPushToken: null });

async function saveTokenToProfile(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('profiles').update({ expo_push_token: token }).eq('user_id', user.id);
  }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [expoPushToken, setExpoPushToken] = React.useState<string | null>(null);

  useEffect(() => {
    if (!Device.isDevice) return;

    const register = async () => {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let final = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        final = status;
      }
      if (final !== 'granted') return;

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      setExpoPushToken(token);
      saveTokenToProfile(token);
    };
    register();
  }, []);

  useEffect(() => {
    if (expoPushToken) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) saveTokenToProfile(expoPushToken);
      });
      return () => subscription.unsubscribe();
    }
  }, [expoPushToken]);

  return (
    <NotificationsContext.Provider value={{ expoPushToken }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
