import React from 'react';
import { View } from 'react-native';

import { useTheme, ThemeContext } from '@/theme/ThemeProvider';
import { Text } from '@/components/primitives/Text';
import { Button } from '@/components/primitives/Button';
import { space } from '@/theme/spacing';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Catches a render crash anywhere below and shows a branded screen with a
// Retry button instead of a white screen of death — CLAUDE.md Phase 20.
// A class component because React only exposes getDerivedStateFromError /
// componentDidCatch on classes; ThemeContext.Consumer reaches tokens without
// needing a functional useTheme() (a boundary can't rely on hooks alongside
// the lifecycle methods that catch the error).
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught a render crash:', error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    const { children } = this.props;

    if (!error) return children;

    return (
      <ThemeContext.Consumer>
        {(ctx) => <FallbackScreen tokens={ctx?.tokens} onRetry={this.handleRetry} />}
      </ThemeContext.Consumer>
    );
  }
}

function FallbackScreen({ tokens, onRetry }: { tokens: ReturnType<typeof useTheme>['tokens'] | undefined; onRetry: () => void }) {
  const colors = tokens?.colors;
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space[6],
        gap: space[3],
        backgroundColor: colors?.background ?? '#faf9f5',
      }}
    >
      <Text variant="headlineLg" color="primaryDark" align="center">
        Something went wrong
      </Text>
      <Text color="onSurfaceVariant" align="center">
        The app hit an unexpected error. Give it another try.
      </Text>
      <View style={{ marginTop: space[4], width: '100%' }}>
        <Button variant="primary" fullWidth onPress={onRetry}>Retry</Button>
      </View>
    </View>
  );
}
