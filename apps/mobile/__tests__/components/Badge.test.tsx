import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Badge, PressableBadge } from '../../components/ui/badge';

describe('Badge', () => {
  it('renders with label', () => {
    render(<Badge label="Test Badge" />);
    expect(screen.getByText('Test Badge')).toBeTruthy();
  });

  it('renders with default variant', () => {
    render(<Badge label="Default" />);
    expect(screen.getByText('Default')).toBeTruthy();
  });

  it('renders with secondary variant', () => {
    render(<Badge label="Secondary" variant="secondary" />);
    expect(screen.getByText('Secondary')).toBeTruthy();
  });

  it('renders with destructive variant', () => {
    render(<Badge label="Destructive" variant="destructive" />);
    expect(screen.getByText('Destructive')).toBeTruthy();
  });

  it('renders with outline variant', () => {
    render(<Badge label="Outline" variant="outline" />);
    expect(screen.getByText('Outline')).toBeTruthy();
  });
});

describe('PressableBadge', () => {
  it('renders with label', () => {
    render(<PressableBadge label="Pressable" onPress={() => {}} />);
    expect(screen.getByText('Pressable')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<PressableBadge label="Click Me" onPress={onPress} />);
    fireEvent.press(screen.getByText('Click Me'));
    expect(onPress).toHaveBeenCalled();
  });
});
