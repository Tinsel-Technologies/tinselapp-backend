import { Injectable, Logger } from '@nestjs/common';
import { MpesaCallbackDto, ProcessedCallback } from './dto/callback.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

interface AuthResponse {
  access_token: string;
  expires_in: number;
}

interface PaymentRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: string;
  Amount: number;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

export interface PaymentResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface ErrorResponse {
  requestId: string;
  errorCode: string;
  errorMessage: string;
}

export interface PaymentDto {
  amount: number;
  phoneNumber: string;
}

@Injectable()
export class PaymentService {

    private readonly logger = new Logger(PaymentService.name);
    
    
  private readonly consumerKey =
    'aFAzQXhNOvd9TUdbuartDKESUiayrcGOJBUT36NWGTvpxAfU';
  private readonly consumerSecret =
    'taIccnSCvtJgeK4qufaisOOMbcwgKz2Ae3JboddDN05wz9JmHSvLlK71trwIW6Jc';
  private readonly businessShortCode = '174379';
  private readonly passkey =
    'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';

  constructor(private prisma: PrismaService) {}

  async getAccessToken(): Promise<string | null> {
    const buffer = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`);
    const basicHeader = buffer.toString('base64');
    const headers = new Headers();
    headers.append('Authorization', `Basic ${basicHeader}`);

    try {
      const response = await fetch(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        { headers },
      );

      if (!response.ok) {
        console.error(
          'Auth response not ok:',
          response.status,
          response.statusText,
        );
        return null;
      }

      const result: AuthResponse = await response.json();
      return result?.access_token || null;
    } catch (error) {
      console.error('Error fetching access token:', error);
      return null;
    }
  }

  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  async mpesaPayment(
    paymentData: PaymentDto,
    userId:string
  ): Promise<PaymentResponse | ErrorResponse | null> {
    const { amount, phoneNumber } = paymentData;

    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const timestamp = this.generateTimestamp();
    const accountReference = `Payment-${Date.now()}`;

    const password = Buffer.from(
      `${this.businessShortCode}${this.passkey}${timestamp}`,
    ).toString('base64');

    const paymentRequest: PaymentRequest = {
      BusinessShortCode: this.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: this.businessShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL:
        'https://tinsel-backend-app-e9iwg.ondigitalocean.app/api/v1/pay/callback',
      AccountReference: accountReference,
      TransactionDesc: `Payment of KES ${amount}`,
    };

    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to retrieve access token');
      }

      const headers = new Headers();
      headers.append('Authorization', `Bearer ${accessToken}`);
      headers.append('Content-Type', 'application/json');

      console.log(
        'Payment request payload:',
        JSON.stringify(paymentRequest, null, 2),
      );

      const response = await fetch(
        'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        {
          method: 'POST',
          headers,
          body: JSON.stringify(paymentRequest),
        },
      );

      if (!response.ok) {
        console.error(
          'Payment response not ok:',
          response.status,
          response.statusText,
        );
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        return null;
      }

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (!responseText) {
        console.error('Empty response from M-Pesa API');
        return null;
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response JSON:', parseError);
        return null;
      }

      console.log('Parsed payment response:', result);

      if (result.CheckoutRequestID) {
        await this.prisma.payment.create({
          data: {
            userId,
            merchantRequestId: result.MerchantRequestID,
            checkoutRequestId: result.CheckoutRequestID,
            amount,
            phoneNumber: formattedPhone,
            accountReference,
            transactionDesc: paymentRequest.TransactionDesc,
            responseCode: result.ResponseCode,
            responseDescription: result.ResponseDescription,
            customerMessage: result.CustomerMessage,
            status: PaymentStatus.PENDING,
          },
        });
      }

      if (result.errorCode || result.errorMessage) {
        console.error('M-Pesa API error:', result);
        return result as ErrorResponse;
      }

      return result as PaymentResponse;
    } catch (error) {
      console.error('Error processing payment:', error);
      return null;
    }
  }

  async processCallback(
    callbackData: MpesaCallbackDto,
  ): Promise<ProcessedCallback> {
    const { stkCallback } = callbackData.Body;

    console.log(
      'Processing M-Pesa callback:',
      JSON.stringify(stkCallback, null, 2),
    );
    const payment = await this.prisma.payment.findUnique({
      where: { checkoutRequestId: stkCallback.CheckoutRequestID },
    });

    if (!payment) {
      console.error(
        `FATAL: Payment record not found for CheckoutRequestID: ${stkCallback.CheckoutRequestID}. Callback data will not be saved.`,
      );
      return {
        merchantRequestId: stkCallback.MerchantRequestID,
        checkoutRequestId: stkCallback.CheckoutRequestID,
        resultCode: stkCallback.ResultCode,
        resultDesc: 'Error: Original payment record not found.',
      };
    }

    const processedCallback: ProcessedCallback = {
      merchantRequestId: stkCallback.MerchantRequestID,
      checkoutRequestId: stkCallback.CheckoutRequestID,
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc,
    };

    if (stkCallback.ResultCode === 0 && stkCallback.CallbackMetadata) {
      const metadata = stkCallback.CallbackMetadata.Item;
      metadata.forEach((item) => {
        switch (item.Name) {
          case 'Amount':
            processedCallback.amount = Number(item.Value);
            break;
          case 'MpesaReceiptNumber':
            processedCallback.mpesaReceiptNumber = String(item.Value);
            break;
          case 'TransactionDate':
            processedCallback.transactionDate = String(item.Value);
            break;
          case 'PhoneNumber':
            processedCallback.phoneNumber = String(item.Value);
            break;
        }
      });
    }

    const newStatus =
      stkCallback.ResultCode === 0
        ? PaymentStatus.COMPLETED
        : PaymentStatus.FAILED;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: newStatus },
        });

        await tx.paymentCallback.create({
          data: {
            paymentId: payment.id,
            merchantRequestId: stkCallback.MerchantRequestID,
            checkoutRequestId: stkCallback.CheckoutRequestID,
            resultCode: stkCallback.ResultCode,
            resultDesc: stkCallback.ResultDesc,
            amount: processedCallback.amount,
            mpesaReceiptNumber: processedCallback.mpesaReceiptNumber,
            transactionDate: processedCallback.transactionDate,
            phoneNumber: processedCallback.phoneNumber,
          },
        });

        if (newStatus === PaymentStatus.COMPLETED && payment.userId) {
          await tx.userBalance.upsert({
            where: { userId: payment.userId },
            update: {
              availableBalance: {
                increment: processedCallback.amount,
              },
            },
            create: {
              userId: payment.userId,
              availableBalance: processedCallback.amount,
            },
          });
          this.logger.log(
            `Updated balance for user ${payment.userId} by ${processedCallback.amount}`,
          );
        }
      });

      this.logger.log(
        `Successfully processed callback for Payment ${payment.id}. Status: ${newStatus}`,
      );
    } catch (error) {
      console.error(
        `Error during database transaction for CheckoutRequestID: ${stkCallback.CheckoutRequestID}`,
        error,
      );
    }

    return processedCallback;
  }

  async getPaymentStatus(checkoutRequestId: string): Promise<any> {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { checkoutRequestId },
        include: { callback: true },
      });

      return payment;
    } catch (error) {
      console.error('Error fetching payment status:', error);
      return null;
    }
  }

  async getPaymentHistory(phoneNumber?: string): Promise<any[]> {
    try {
      const payments = await this.prisma.payment.findMany({
        where: phoneNumber
          ? { phoneNumber: this.formatPhoneNumber(phoneNumber) }
          : {},
        include: { callback: true },
        orderBy: { createdAt: 'desc' },
      });

      return payments;
    } catch (error) {
      console.error('Error fetching payment history:', error);
      return [];
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    let cleaned = phoneNumber.replace(/[\s\-\+]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }
    return cleaned;
  }
}
