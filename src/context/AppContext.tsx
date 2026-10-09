import React, { createContext, useContext, useReducer, ReactNode, useMemo } from 'react';
import { Account, Transaction, ScamCase, Alert, MoneyTrail } from '../types';
import { accounts as defaultAccounts, transactions as defaultTransactions, scamCases as defaultCases, alerts as defaultAlerts } from '../data/mockData';
import { traceMoneyTrail } from '../engine/trailEngine';
import { findNextHopCandidates } from '../engine/nextHopEngine';
import { postFreezeRecommendation } from '../services/api';
import { SyntheticDataConfig } from '../engine/syntheticData';

interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  cases: ScamCase[];
  alerts: Alert[];
  selectedAccountId: string | null;
  selectedCaseId: string | null;
  selectedTransactionId: string | null;
  trailData: MoneyTrail | null;
  frozenAccounts: Set<string>;
  watchlistAccounts: Set<string>;
  flaggedAccounts: Set<string>;
  toasts: { id: string; message: string; type: 'success' | 'warning' | 'info' }[];
  syntheticConfig?: SyntheticDataConfig;
}

type Action =
  | { type: 'SELECT_ACCOUNT'; id: string | null }
  | { type: 'SELECT_CASE'; id: string | null }
  | { type: 'SELECT_TRANSACTION'; id: string | null }
  | { type: 'LOAD_TRAIL'; caseId: string }
  | { type: 'SET_TRAIL'; trail: MoneyTrail | null }
  | { type: 'FREEZE_ACCOUNT'; id: string }
  | { type: 'UNFREEZE_ACCOUNT'; id: string }
  | { type: 'ADD_TO_WATCHLIST'; id: string }
  | { type: 'FLAG_ACCOUNT'; id: string }
  | { type: 'MARK_ALERT_READ'; id: string }
  | { type: 'UPDATE_CASE_STATUS'; id: string; status: ScamCase['status'] }
  | { type: 'SET_DATA'; accounts: Account[]; transactions: Transaction[]; cases: ScamCase[]; alerts?: Alert[] }
  | { type: 'ADD_TOAST'; toast: { id: string; message: string; type: 'success' | 'warning' | 'info' } }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'SET_SYNTHETIC_CONFIG'; config: SyntheticDataConfig };

const initialState: AppState = {
  accounts: defaultAccounts,
  transactions: defaultTransactions,
  cases: defaultCases,
  alerts: defaultAlerts,
  selectedAccountId: null,
  selectedCaseId: null,
  selectedTransactionId: null,
  trailData: null,
  frozenAccounts: new Set<string>(),
  watchlistAccounts: new Set<string>(),
  flaggedAccounts: new Set<string>(),
  toasts: [],
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SELECT_ACCOUNT':
      return { ...state, selectedAccountId: action.id };
    case 'SELECT_CASE':
      return { ...state, selectedCaseId: action.id };
    case 'SELECT_TRANSACTION':
      return { ...state, selectedTransactionId: action.id };
    case 'LOAD_TRAIL': {
      const scamCase = state.cases.find(c => c.id === action.caseId);
      if (!scamCase) return state;
      const trail = traceMoneyTrail(scamCase.reportedTransactionId, state.transactions);
      if (trail) {
        trail.caseId = action.caseId;
        // Add next-hop prediction for the last account in the trail
        const lastStep = trail.steps[trail.steps.length - 1];
        if (lastStep) {
          const prediction = findNextHopCandidates(lastStep.toAccount, state.transactions, state.accounts);
          trail.predictedNextHop = prediction;
        }
      }
      return { ...state, trailData: trail, selectedCaseId: action.caseId };
    }
    case 'SET_TRAIL':
      return { ...state, trailData: action.trail };
    case 'FREEZE_ACCOUNT': {
      const newFrozen = new Set(state.frozenAccounts);
      newFrozen.add(action.id);
      const newAccounts = state.accounts.map(a =>
        a.id === action.id ? { ...a, status: 'frozen' as const } : a
      );
      // Asynchronously record simulated freeze recommendation on backend
      postFreezeRecommendation(action.id, state.selectedCaseId || undefined).catch(() => {});
      return { ...state, frozenAccounts: newFrozen, accounts: newAccounts };
    }
    case 'UNFREEZE_ACCOUNT': {
      const newFrozen = new Set(state.frozenAccounts);
      newFrozen.delete(action.id);
      return { ...state, frozenAccounts: newFrozen };
    }
    case 'ADD_TO_WATCHLIST': {
      const newWatchlist = new Set(state.watchlistAccounts);
      newWatchlist.add(action.id);
      return { ...state, watchlistAccounts: newWatchlist };
    }
    case 'FLAG_ACCOUNT': {
      const newFlagged = new Set(state.flaggedAccounts);
      newFlagged.add(action.id);
      return { ...state, flaggedAccounts: newFlagged };
    }
    case 'MARK_ALERT_READ':
      return {
        ...state,
        alerts: state.alerts.map(a => a.id === action.id ? { ...a, read: true } : a),
      };
    case 'UPDATE_CASE_STATUS':
      return {
        ...state,
        cases: state.cases.map(c => c.id === action.id ? { ...c, status: action.status } : c),
      };
    case 'SET_DATA':
      return {
        ...state,
        accounts: action.accounts,
        transactions: action.transactions,
        cases: action.cases,
        alerts: action.alerts || state.alerts,
        trailData: null,
        selectedAccountId: null,
        selectedCaseId: null,
      };
    case 'SET_SYNTHETIC_CONFIG':
      return { ...state, syntheticConfig: action.config };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: () => {} });

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

// Convenience hooks
export function useAccounts() {
  const { state } = useApp();
  return state.accounts;
}

export function useTransactions() {
  const { state } = useApp();
  return state.transactions;
}

export function useCases() {
  const { state } = useApp();
  return state.cases;
}

export function useAlerts() {
  const { state } = useApp();
  return state.alerts;
}
