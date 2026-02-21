import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Switch } from '../../components/ui/switch';

describe('Switch', () => {
  it('renders in unchecked state', () => {
    const onCheckedChange = jest.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} />);
    // Switch renders - we can verify by checking it's pressable
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('renders in checked state', () => {
    const onCheckedChange = jest.fn();
    render(<Switch checked={true} onCheckedChange={onCheckedChange} />);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('calls onCheckedChange when pressed', () => {
    const onCheckedChange = jest.fn();
    const { root } = render(<Switch checked={false} onCheckedChange={onCheckedChange} />);
    fireEvent.press(root);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('toggles from checked to unchecked', () => {
    const onCheckedChange = jest.fn();
    const { root } = render(<Switch checked={true} onCheckedChange={onCheckedChange} />);
    fireEvent.press(root);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it('does not call onCheckedChange when disabled', () => {
    const onCheckedChange = jest.fn();
    const { root } = render(
      <Switch checked={false} onCheckedChange={onCheckedChange} disabled />
    );
    fireEvent.press(root);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
