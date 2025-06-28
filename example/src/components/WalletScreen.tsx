import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View, Text } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
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
    showConfetti,
    paymentReceivedAmount,
    
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
    closeReceiveModal,
    setReceiveAmount,
    setShowSendModal,
    setLightningInvoice,
    handleMintUrlModalClose,
  } = useWallet();

  return (
    <>
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
          onClose={closeReceiveModal}
          onAmountChange={setReceiveAmount}
          onCreateInvoice={createInvoice}
          onCopyInvoice={copyToClipboard}
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
      
      {/* Confetti Animation Overlay - Outside SafeAreaView for proper layering */}
      {showConfetti && (
        <View style={styles.confettiContainer}>
          <ConfettiCannon
            count={150}
            origin={{x: 0, y: 0}}
            fadeOut={true}
            autoStart={true}
            explosionSpeed={350}
            fallSpeed={2500}
            colors={['#FFD700', '#4CAF50', '#2196F3', '#FF9800', '#E91E63']}
          />
          <View style={styles.successOverlay}>
            <Text style={styles.successText}>
              Payment Received! 🎉
            </Text>
            <Text style={styles.successAmount}>
              +{paymentReceivedAmount.toString()} sats
            </Text>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: 'none', // Allow touches to pass through to content below
  },
  successOverlay: {
    position: 'absolute',
    top: '60%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10000,
    elevation: 10000,
  },
  successText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
}); 