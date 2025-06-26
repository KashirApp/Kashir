import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import {
  WalletHeader,
  WalletStatus,
  WalletBalance,
  WalletActions,
  MintInfo,
  ReceiveModal,
  SendModal,
  useWallet,
} from './wallet';

interface WalletScreenProps {
  onClose: () => void;
}

export function WalletScreen({ onClose }: WalletScreenProps) {
  const {
    // State
    balance,
    moduleStatus,
    wallet,
    mintUrl,
    showReceiveModal,
    receiveAmount,
    invoice,
    isLoadingInvoice,
    showSendModal,
    lightningInvoice,
    isSending,
    
    // Actions
    testWalletCreation,
    handleReceive,
    handleSend,
    createInvoice,
    copyToClipboard,
    refreshBalance,
    checkAndMintPendingTokens,
    sendPayment,
    
    // Modal controls
    setShowReceiveModal,
    setReceiveAmount,
    setShowSendModal,
    setLightningInvoice,
  } = useWallet();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <WalletHeader onClose={onClose} />
      
      <WalletStatus status={moduleStatus} />
      
      <WalletBalance 
        balance={balance} 
        wallet={wallet} 
        onRefresh={refreshBalance} 
      />
      
      <WalletActions
        wallet={wallet}
        onCreateWallet={testWalletCreation}
        onReceive={handleReceive}
        onSend={handleSend}
      />
      
      <MintInfo mintUrl={mintUrl} />
      
      <ReceiveModal
        visible={showReceiveModal}
        receiveAmount={receiveAmount}
        invoice={invoice}
        isLoadingInvoice={isLoadingInvoice}
        onClose={() => setShowReceiveModal(false)}
        onAmountChange={setReceiveAmount}
        onCreateInvoice={createInvoice}
        onCopyInvoice={copyToClipboard}
        onCheckPayment={checkAndMintPendingTokens}
      />
      
      <SendModal
        visible={showSendModal}
        lightningInvoice={lightningInvoice}
        isSending={isSending}
        onClose={() => setShowSendModal(false)}
        onInvoiceChange={setLightningInvoice}
        onSendPayment={sendPayment}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
}); 