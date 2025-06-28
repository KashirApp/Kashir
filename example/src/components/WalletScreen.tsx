import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import {
  WalletBalance,
  WalletActions,
  MintInfo,
  ReceiveModal,
  SendModal,
  MintUrlModal,
  useWallet,
} from './wallet';

export function WalletScreen() {
  const {
    // State
    balance,
    wallet,
    mintUrl,
    isLoadingWallet,
    showReceiveModal,
    receiveAmount,
    invoice,
    isLoadingInvoice,
    showSendModal,
    lightningInvoice,
    isSending,
    showMintUrlModal,
    
    // Actions
    testWalletCreation,
    handleReceive,
    handleSend,
    createInvoice,
    copyToClipboard,
    refreshBalance,
    checkAndMintPendingTokens,
    sendPayment,
    promptForMintUrl,
    handleMintUrlSubmit,
    
    // Modal controls
    setShowReceiveModal,
    setReceiveAmount,
    setShowSendModal,
    setLightningInvoice,
    handleMintUrlModalClose,
  } = useWallet();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <WalletBalance 
        balance={balance} 
        wallet={wallet} 
        onRefresh={refreshBalance} 
      />
      
      <WalletActions
        wallet={wallet}
        isLoadingWallet={isLoadingWallet}
        onCreateWallet={testWalletCreation}
        onReceive={handleReceive}
        onSend={handleSend}
      />
      
      <MintInfo mintUrl={mintUrl} onChangeMint={promptForMintUrl} />
      
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

      <MintUrlModal
        visible={showMintUrlModal}
        onClose={handleMintUrlModalClose}
        onSubmit={handleMintUrlSubmit}
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