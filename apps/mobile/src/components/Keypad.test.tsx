import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import {
  EMPTY_ENTRY,
  allowsNegative,
  entryValue,
  pressKey,
  type KeypadKey,
} from '../battle/answer-entry';
import '../i18n';
import { AnswerField } from './AnswerField';
import { Keypad } from './Keypad';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

/** The keypad wired the way a battle screen wires it. */
function Harness({ arena, onSubmit }: { arena: 1 | 3 | 5; onSubmit: (value: number) => void }) {
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const onKey = useCallback((key: KeypadKey) => setEntry((e) => pressKey(e, key, arena)), [arena]);
  const value = entryValue(entry);
  return (
    <>
      <AnswerField entry={entry} showSign={allowsNegative(arena)} onKey={onKey} />
      <Keypad
        onKey={onKey}
        canSubmit={value !== null}
        onSubmit={() => {
          if (value !== null) onSubmit(value);
          setEntry(EMPTY_ENTRY);
        }}
      />
    </>
  );
}

const tap = (id: string) => fireEvent(screen.getByTestId(id), 'pressIn');

describe('keypad (S2-07)', () => {
  it('Done when: a 3-digit answer is typed and sent, one tap per digit', () => {
    const sent = jest.fn();
    render(<Harness arena={3} onSubmit={sent} />);
    expect(screen.getByTestId('answer-field')).toHaveTextContent('?');
    for (const d of ['1', '4', '4']) tap(`key-${d}`);
    expect(screen.getByTestId('answer-field')).toHaveTextContent('144');
    fireEvent.press(screen.getByTestId('key-submit'));
    expect(sent).toHaveBeenCalledWith(144);
    expect(screen.getByTestId('answer-field')).toHaveTextContent('?');
  });

  it('digits act on touch-down, with a haptic tick', () => {
    render(<Harness arena={3} onSubmit={jest.fn()} />);
    tap('key-7');
    expect(screen.getByTestId('answer-field')).toHaveTextContent('7');
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('delete and the arena limit', () => {
    render(<Harness arena={1} onSubmit={jest.fn()} />);
    for (const d of ['3', '9', '9']) tap(`key-${d}`);
    expect(screen.getByTestId('answer-field')).toHaveTextContent('39');
    tap('key-delete');
    expect(screen.getByTestId('answer-field')).toHaveTextContent('3');
  });

  it('Hit! does nothing until a digit is typed', () => {
    const sent = jest.fn();
    render(<Harness arena={3} onSubmit={sent} />);
    expect(screen.getByTestId('key-submit')).toBeDisabled();
    fireEvent.press(screen.getByTestId('key-submit'));
    expect(sent).not.toHaveBeenCalled();
  });

  it('the ± key only in Power Peak', () => {
    const sent = jest.fn();
    const { unmount } = render(<Harness arena={3} onSubmit={sent} />);
    expect(screen.queryByTestId('key-sign')).toBeNull();
    unmount();
    render(<Harness arena={5} onSubmit={sent} />);
    tap('key-sign');
    tap('key-8');
    expect(screen.getByTestId('answer-field')).toHaveTextContent('−8');
    fireEvent.press(screen.getByTestId('key-submit'));
    expect(sent).toHaveBeenCalledWith(-8);
  });

  it('every key is a labelled button', () => {
    render(<Harness arena={5} onSubmit={jest.fn()} />);
    for (const id of ['key-1', 'key-0', 'key-delete', 'key-submit', 'key-sign']) {
      const key = screen.getByTestId(id);
      expect(key.props.accessibilityRole ?? key.props.role).toBe('button');
      expect(key.props.accessibilityLabel).toBeTruthy();
    }
    expect(screen.getByLabelText('Hapus')).toBeOnTheScreen();
    expect(screen.getByLabelText('Serang dengan jawaban ini')).toBeOnTheScreen();
  });

  it('locked after a wrong answer: keys do nothing', () => {
    const onKey = jest.fn();
    render(<Keypad onKey={onKey} onSubmit={jest.fn()} canSubmit locked />);
    tap('key-5');
    expect(onKey).not.toHaveBeenCalled();
    expect(screen.getByTestId('key-submit')).toBeDisabled();
  });
});
