interface LNURLPayResponse {
  callback: string;
  maxSendable: number;
  minSendable: number;
  metadata: string;
  tag: string;
}

interface LNURLPayInvoiceResponse {
  pr: string;
  successAction?: any;
}

export class LNURLService {
  /**
   * Converts a Lightning address to LNURL if needed
   */
  private lightningAddressToLNURL(lightningAddress: string): string {
    if (lightningAddress.startsWith('lnurl')) {
      return lightningAddress;
    }

    // Lightning address format: user@domain.com
    const [username, domain] = lightningAddress.split('@');
    if (!username || !domain) {
      throw new Error('Invalid Lightning address format');
    }

    // Convert to LNURL callback URL
    const url = `https://${domain}/.well-known/lnurlp/${username}`;
    return url;
  }

  /**
   * Gets the LNURL-pay callback information
   */
  async getLNURLPayInfo(
    lightningAddressOrLNURL: string
  ): Promise<LNURLPayResponse> {
    try {
      let url: string;

      if (lightningAddressOrLNURL.startsWith('lnurl')) {
        // Decode LNURL
        // For now, we'll assume it's already a URL - full LNURL decoding would need bech32
        throw new Error(
          'Raw LNURL decoding not implemented yet. Please use Lightning address format (user@domain.com)'
        );
      } else {
        // Lightning address
        url = this.lightningAddressToLNURL(lightningAddressOrLNURL);
      }

      console.log('Fetching LNURL-pay info from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `LNURL-pay request failed: ${response.status} ${response.statusText}`
        );
      }

      const data: LNURLPayResponse = await response.json();

      console.log('LNURL-pay info response:', JSON.stringify(data, null, 2));

      if (data.tag !== 'payRequest') {
        throw new Error('Invalid LNURL-pay response: tag is not payRequest');
      }

      return data;
    } catch (error) {
      console.error('Error fetching LNURL-pay info:', error);
      throw error;
    }
  }

  /**
   * Requests an invoice from the LNURL-pay callback
   */
  async requestInvoice(
    callbackUrl: string,
    amountMillisats: number,
    zapRequest?: string
  ): Promise<LNURLPayInvoiceResponse> {
    try {
      // Manually build URL parameters instead of using URLSearchParams (not available in React Native)
      let url = callbackUrl;
      const separator = callbackUrl.includes('?') ? '&' : '?';
      url += `${separator}amount=${amountMillisats}`;

      if (zapRequest) {
        // URL encode the zap request JSON
        const encodedZapRequest = encodeURIComponent(zapRequest);
        url += `&nostr=${encodedZapRequest}`;
      }

      console.log('Requesting invoice from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        let errorDetails = `${response.status} ${response.statusText}`;
        try {
          const errorBody = await response.text();
          console.log('Error response body:', errorBody);
          errorDetails += ` - ${errorBody}`;
        } catch (e) {
          // Ignore error reading response body
        }
        throw new Error(`Invoice request failed: ${errorDetails}`);
      }

      const data: LNURLPayInvoiceResponse = await response.json();

      if (!data.pr) {
        throw new Error('Invalid invoice response: missing payment request');
      }

      return data;
    } catch (error) {
      console.error('Error requesting invoice:', error);
      throw error;
    }
  }

  /**
   * Full LNURL-pay flow: get info and request invoice
   */
  async createZapInvoice(
    lightningAddressOrLNURL: string,
    amountSats: number,
    zapRequest: string
  ): Promise<string> {
    try {
      // Step 1: Get LNURL-pay info
      const payInfo = await this.getLNURLPayInfo(lightningAddressOrLNURL);

      // Convert sats to millisats
      const amountMillisats = amountSats * 1000;

      // Check amount limits
      if (amountMillisats < payInfo.minSendable) {
        throw new Error(
          `Amount too small. Minimum: ${payInfo.minSendable / 1000} sats`
        );
      }

      if (amountMillisats > payInfo.maxSendable) {
        throw new Error(
          `Amount too large. Maximum: ${payInfo.maxSendable / 1000} sats`
        );
      }

      // Step 2: Request invoice with zap request
      const invoiceResponse = await this.requestInvoice(
        payInfo.callback,
        amountMillisats,
        zapRequest
      );

      return invoiceResponse.pr;
    } catch (error) {
      console.error('Error creating zap invoice:', error);
      throw error;
    }
  }
}
