import { createContext, useContext } from 'react';

export const AuthSheetContext = createContext<() => void>(() => {});
/** Opens the sign-in / sign-up sheet. */
export const useOpenAuth = () => useContext(AuthSheetContext);
