import { defineStore } from 'pinia';
import { ref } from 'vue';

type DialogType = 'confirm' | 'prompt';

interface DialogState {
  visible: boolean;
  type: DialogType;
  title: string;
  message: string;
  placeholder: string;
  inputValue: string;
  resolver: ((value: boolean | string | null) => void) | null;
}

const initialState: DialogState = {
  visible: false,
  type: 'confirm',
  title: '',
  message: '',
  placeholder: '',
  inputValue: '',
  resolver: null,
};

export const useDialogStore = defineStore('dialog', () => {
  const state = ref<DialogState>({ ...initialState });

  function confirm(title: string, message: string = ''): Promise<boolean> {
    return new Promise((resolve) => {
      state.value = {
        visible: true,
        type: 'confirm',
        title,
        message,
        placeholder: '',
        inputValue: '',
        resolver: resolve as (value: boolean | string | null) => void,
      };
    });
  }

  function prompt(title: string, placeholder: string = '', defaultValue: string = ''): Promise<string | null> {
    return new Promise((resolve) => {
      state.value = {
        visible: true,
        type: 'prompt',
        title,
        message: '',
        placeholder,
        inputValue: defaultValue,
        resolver: resolve as (value: boolean | string | null) => void,
      };
    });
  }

  function ok() {
    if (state.value.type === 'confirm') {
      state.value.resolver?.(true);
    } else {
      const val = state.value.inputValue.trim();
      state.value.resolver?.(val || null);
    }
    close();
  }

  function cancel() {
    state.value.resolver?.(null);
    close();
  }

  function close() {
    state.value = { ...initialState };
  }

  return { state, confirm, prompt, ok, cancel, close };
});
