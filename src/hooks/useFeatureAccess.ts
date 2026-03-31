'use client';

import { useState, useEffect, useCallback } from 'react';

const OPENROUTER_KEY = 'ne_openrouter_key';
const REPLICATE_KEY = 'ne_replicate_key';
const ELEVENLABS_KEY = 'ne_elevenlabs_key';
const KEYS_CHANGED_EVENT = 'ne-api-keys-changed';

export type FeatureAccess = {
  /** Whether users must supply their own API keys */
  userApiKeys: boolean;
  hasOpenRouterKey: boolean;
  hasReplicateKey: boolean;
  hasElevenLabsKey: boolean;
  openRouterKey: string;
  replicateKey: string;
  elevenLabsKey: string;
  setOpenRouterKey: (key: string) => void;
  setReplicateKey: (key: string) => void;
  setElevenLabsKey: (key: string) => void;
  clearKeys: () => void;
};

function readKeys() {
  return {
    openRouterKey: localStorage.getItem(OPENROUTER_KEY) ?? '',
    replicateKey: localStorage.getItem(REPLICATE_KEY) ?? '',
    elevenLabsKey: localStorage.getItem(ELEVENLABS_KEY) ?? '',
  };
}

function notifyChange() {
  window.dispatchEvent(new Event(KEYS_CHANGED_EVENT));
}

export function useFeatureAccess(): FeatureAccess {
  const userApiKeys = process.env.NEXT_PUBLIC_USER_API_KEYS === 'true';

  const [openRouterKey, setOpenRouterKeyState] = useState('');
  const [replicateKey, setReplicateKeyState] = useState('');
  const [elevenLabsKey, setElevenLabsKeyState] = useState('');

  // Read from localStorage on mount + sync across hook instances
  useEffect(() => {
    if (!userApiKeys) return;

    const sync = () => {
      const keys = readKeys();
      setOpenRouterKeyState(keys.openRouterKey);
      setReplicateKeyState(keys.replicateKey);
      setElevenLabsKeyState(keys.elevenLabsKey);
    };

    sync();
    window.addEventListener(KEYS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(KEYS_CHANGED_EVENT, sync);
  }, [userApiKeys]);

  const setOpenRouterKey = useCallback((key: string) => {
    localStorage.setItem(OPENROUTER_KEY, key);
    setOpenRouterKeyState(key);
    notifyChange();
  }, []);

  const setReplicateKey = useCallback((key: string) => {
    localStorage.setItem(REPLICATE_KEY, key);
    setReplicateKeyState(key);
    notifyChange();
  }, []);

  const setElevenLabsKey = useCallback((key: string) => {
    localStorage.setItem(ELEVENLABS_KEY, key);
    setElevenLabsKeyState(key);
    notifyChange();
  }, []);

  const clearKeys = useCallback(() => {
    localStorage.removeItem(OPENROUTER_KEY);
    localStorage.removeItem(REPLICATE_KEY);
    localStorage.removeItem(ELEVENLABS_KEY);
    setOpenRouterKeyState('');
    setReplicateKeyState('');
    setElevenLabsKeyState('');
    notifyChange();
  }, []);

  // If not in user-keys mode, server keys are assumed present
  const hasOpenRouterKey = userApiKeys ? !!openRouterKey : true;
  const hasReplicateKey = userApiKeys ? !!replicateKey : true;
  const hasElevenLabsKey = userApiKeys ? !!elevenLabsKey : true;

  return {
    userApiKeys,
    hasOpenRouterKey,
    hasReplicateKey,
    hasElevenLabsKey,
    openRouterKey,
    replicateKey,
    elevenLabsKey,
    setOpenRouterKey,
    setReplicateKey,
    setElevenLabsKey,
    clearKeys,
  };
}
