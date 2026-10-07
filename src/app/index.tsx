import { StyleSheet, Text, View } from 'react-native';

/**
 * Stage 0 placeholder screen.
 * Единственный экран фундамента: продуктовые функции появятся на следующих
 * стадиях (см. docs/PROJECT_STATE.md).
 */
export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Orbit</Text>
      <Text style={styles.subtitle}>Stage 0 — project foundation</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.6,
  },
});
