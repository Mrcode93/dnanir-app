import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Wallet } from '../types';
import { getWallets, addWallet as dbAddWallet, updateWallet as dbUpdateWallet, deleteWallet as dbDeleteWallet, setDefaultWallet as dbSetDefaultWallet } from '../database/database';

interface WalletContextType {
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  setSelectedWallet: (wallet: Wallet | null) => void;
  refreshWallets: () => Promise<void>;
  addWallet: (wallet: Omit<Wallet, 'id'>) => Promise<number>;
  updateWallet: (id: number, wallet: Partial<Wallet>) => Promise<void>;
  deleteWallet: (id: number) => Promise<void>;
  setDefaultWallet: (id: number) => Promise<void>;
  isLoading: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWalletState] = useState<Wallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  const refreshWallets = useCallback(async () => {
    try {
      const dbWallets = await getWallets();
      setWallets(dbWallets);

      if (!hasInitialized) {
        // First load only: auto-select the default wallet
        if (dbWallets.length > 0) {
          const defaultWallet = dbWallets.find(w => w.isDefault) || dbWallets[0];
          setSelectedWalletState(defaultWallet);
        }
        setHasInitialized(true);
      } else if (selectedWallet) {
        // Update the selected wallet data if it still exists
        const updatedSelected = dbWallets.find(w => w.id === selectedWallet.id);
        if (updatedSelected) {
          setSelectedWalletState(updatedSelected);
        } else {
          // Selected wallet was deleted, reset to all wallets
          setSelectedWalletState(null);
        }
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  }, [selectedWallet]);

  useEffect(() => {
    refreshWallets();
  }, []);

  const setSelectedWallet = (wallet: Wallet | null) => {
    setSelectedWalletState(wallet);
  };

  const addWallet = async (wallet: Omit<Wallet, 'id'>) => {
    const id = await dbAddWallet(wallet);
    await refreshWallets();
    return id;
  };

  const updateWallet = async (id: number, wallet: Partial<Wallet>) => {
    await dbUpdateWallet(id, wallet);
    await refreshWallets();
  };

  const deleteWallet = async (id: number) => {
    await dbDeleteWallet(id);
    await refreshWallets();
  };

  const setDefaultWallet = async (id: number) => {
    await dbSetDefaultWallet(id);
    await refreshWallets();
  };

  return (
    <WalletContext.Provider
      value={{
        wallets,
        selectedWallet,
        setSelectedWallet,
        refreshWallets,
        addWallet,
        updateWallet,
        deleteWallet,
        setDefaultWallet,
        isLoading,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallets = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallets must be used within a WalletProvider');
  }
  return context;
};
