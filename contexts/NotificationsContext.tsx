import React, { createContext, useContext, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

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
    };
    register();
  }, []);

  return (
    <NotificationsContext.Provider value={{ expoPushToken }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
