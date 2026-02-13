import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { fonts } from '@/constants/theme';

const weightToFont: Record<string, string> = {
  '200': fonts.light,
  '300': fonts.light,
  '400': fonts.regular,
  '500': fonts.semiBold,
  '600': fonts.semiBold,
  '700': fonts.bold,
  '800': fonts.black,
  '900': fonts.black,
};

export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) || {};
  const weight = (flat as { fontWeight?: string }).fontWeight;
  const fontFamily = weight ? weightToFont[weight] || fonts.regular : fonts.regular;
  return <RNText style={[{ fontFamily }, style]} {...props} />;
}
