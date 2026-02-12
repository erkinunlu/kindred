import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.hideAsync();

export default function Index() {
  return <Redirect href="/login" />;
}
