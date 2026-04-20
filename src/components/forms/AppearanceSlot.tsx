/**
 * AppearanceSlot - React Context for injecting Appearance section into forms
 * PropertyPanel provides the slot, each form renders it after Basic Information
 */

import { createContext, useContext } from 'react';

const AppearanceSlotContext = createContext<React.ReactNode>(null);

export const AppearanceSlotProvider = AppearanceSlotContext.Provider;

export const useAppearanceSlot = () => useContext(AppearanceSlotContext);
