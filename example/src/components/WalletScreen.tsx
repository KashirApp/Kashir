import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfettiCannon from 'react-native-confetti-cannon';
import {
  WalletBalance,
  WalletActions,
  ReceiveModal,
  SendModal,
  QRScanner,
} from './wallet';
import { useWallet } from './wallet/hooks/useWallet';
import { MnemonicModal } from './wallet/components/MnemonicModal';
import { RecoverWalletModal } from './wallet/components/RecoverWalletModal';
import { MintUrlModal } from './wallet/components/MintUrlModal';
import { formatSats } from './wallet/utils';

// Reusable Success Confetti Component
interface SuccessConfettiProps {
  visible: boolean;
  children: React.ReactNode;
}

function SuccessConfetti({ visible, children }: SuccessConfettiProps) {
  if (!visible) return null;

  return (
    <View style={styles.confettiContainer}>
      <ConfettiCannon
        count={150}
        origin={{ x: 0, y: 0 }}
        fadeOut={false}
        autoStart={true}
        explosionSpeed={500}
        fallSpeed={3000}
        colors={['#FFD700', '#4CAF50', '#2196F3', '#FF9800', '#E91E63']}
      />
      <View style={styles.successOverlay}>{children}</View>
    </View>
  );
}

export function WalletScreen() {
  const [showQRScanner, setShowQRScanner] = React.useState(false);

  const {
    // State
    totalBalance,
    wallet,
    isLoadingWallet,
    isInitializing,
    showReceiveModal,
    receiveAmount,
    invoice,
    isLoadingInvoice,
    showSendModal,
    lightningInvoice,
    isSending,
    showConfetti,
    paymentReceivedAmount,
    showSentConfetti,
    paymentSentAmount,
    showSendingLoader,
    showReceivingLoader,
    generatedMnemonic,
    showMnemonicModal,
    showRecoverModal,
    showRecoveryLoader,
    showRecoveryConfetti,
    showMintUrlModal,
    shouldCreateWalletAfterMint,

    // Actions
    testWalletCreation,
    handleReceive,
    handleSend,
    createInvoice,
    copyToClipboard,
    sendPayment,
    sendCashuToken,
    receiveCashuToken,
    handleRecoverWallet,
    handleWalletRecovery,

    // Modal controls
    closeReceiveModal,
    setReceiveAmount,
    setShowSendModal,
    setLightningInvoice,
    handleMnemonicModalDone,
    setShowRecoverModal,
    handleMintUrlSubmit,
    handleMintUrlModalClose,
  } = useWallet();

  const handleShowScanner = () => {
    // Close the send modal first
    setShowSendModal(false);
    // Then show the scanner
    setShowQRScanner(true);
  };

  const handleScanResult = (data: string) => {
    // Extract Lightning invoice from QR code data - same logic as before
    let extractedInvoice = data;
    if (data.toLowerCase().startsWith('lightning:')) {
      extractedInvoice = data.substring(10);
    }

    // Set the invoice and close scanner - same as before
    setLightningInvoice(extractedInvoice);
    setShowQRScanner(false);

    // Trigger payment confirmation directly with the scanned invoice - same as before
    sendPayment();
  };

  // Adapter functions for modal prop compatibility
  const handleSendCashuToken = async (
    amount: string,
    _memo?: string
  ): Promise<any> => {
    const amountBigInt = BigInt(parseInt(amount, 10));
    return sendCashuToken(amountBigInt);
  };

  const handleCopyInvoice = () => {
    copyToClipboard(invoice);
  };

  return (
    <>
      <SafeAreaView style={styles.container}>
        {isInitializing ? (
          <View style={styles.initializingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.initializingText}>Initializing Wallet...</Text>
            <Text style={styles.initializingSubtext}>
              Please wait while we set up your wallet
            </Text>
          </View>
        ) : (
          <>
            <WalletBalance balance={totalBalance} wallet={wallet} />

            <WalletActions
              wallet={wallet}
              isLoadingWallet={isLoadingWallet}
              onCreateWallet={testWalletCreation}
              onRecoverWallet={handleRecoverWallet}
              onReceive={handleReceive}
              onSend={handleSend}
            />
          </>
        )}

        <ReceiveModal
          visible={showReceiveModal}
          receiveAmount={receiveAmount}
          invoice={invoice}
          isLoadingInvoice={isLoadingInvoice}
          onClose={closeReceiveModal}
          onAmountChange={setReceiveAmount}
          onCreateInvoice={createInvoice}
          onCopyInvoice={handleCopyInvoice}
          onReceiveCashuToken={receiveCashuToken}
        />

        <SendModal
          visible={showSendModal}
          lightningInvoice={lightningInvoice}
          isSending={isSending}
          onClose={() => setShowSendModal(false)}
          onInvoiceChange={setLightningInvoice}
          onSendPayment={sendPayment}
          onShowScanner={handleShowScanner}
          onSendCashuToken={handleSendCashuToken}
        />

        <MnemonicModal
          visible={showMnemonicModal}
          mnemonic={generatedMnemonic}
          onDone={handleMnemonicModalDone}
        />

        <RecoverWalletModal
          visible={showRecoverModal}
          onClose={() => setShowRecoverModal(false)}
          onRecover={handleWalletRecovery}
        />

        <QRScanner
          visible={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={handleScanResult}
        />

        <MintUrlModal
          visible={showMintUrlModal}
          onClose={handleMintUrlModalClose}
          onSubmit={handleMintUrlSubmit}
          isWalletCreation={shouldCreateWalletAfterMint}
        />
      </SafeAreaView>

      {/* Confetti Animation Overlay - Outside SafeAreaView for proper layering */}
      {showConfetti && (
        <SuccessConfetti visible={showConfetti}>
          <Text style={styles.successText}>Payment Received! 🎉</Text>
          <Text style={styles.successAmount}>
            +{formatSats(paymentReceivedAmount)}
          </Text>
        </SuccessConfetti>
      )}

      {/* Payment Sent Confetti Animation */}
      {showSentConfetti && (
        <SuccessConfetti visible={showSentConfetti}>
          <Text style={styles.sentText}>Payment Sent! ⚡</Text>
          <Text style={styles.sentAmount}>
            -{formatSats(paymentSentAmount)}
          </Text>
        </SuccessConfetti>
      )}

      {/* Wallet Recovery Confetti Animation */}
      {showRecoveryConfetti && (
        <SuccessConfetti visible={showRecoveryConfetti}>
          <Text style={styles.recoveryText}>Wallet Recovered! 🎉</Text>
          <Text style={styles.recoverySubtext}>
            Your wallet has been successfully restored
          </Text>
        </SuccessConfetti>
      )}

      {/* Payment Sending Loader */}
      {showSendingLoader && (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Sending Payment...</Text>
            <Text style={styles.loadingSubtext}>
              Please wait while we process your transaction
            </Text>
          </View>
        </View>
      )}

      {/* Token Receiving Loader */}
      {showReceivingLoader && (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Receiving Token...</Text>
            <Text style={styles.loadingSubtext}>
              Please wait while we redeem your cashu token
            </Text>
          </View>
        </View>
      )}

      {/* Wallet Recovery Loader */}
      {showRecoveryLoader && (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Recovering Wallet...</Text>
            <Text style={styles.loadingSubtext}>
              Please wait while we restore your wallet from the recovery phrase
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
  initializingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  initializingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  initializingSubtext: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    lineHeight: 22,
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
  sentText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.95)',
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
  sentAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.95)',
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
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9998,
    elevation: 9998,
  },
  loadingOverlay: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
    maxWidth: 250,
    lineHeight: 20,
  },
  recoveryText: {
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
  recoverySubtext: {
    fontSize: 18,
    fontWeight: '600',
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
